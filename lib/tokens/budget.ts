// Token budget — a single shared pool per workspace (the chosen model), plus
// per-model sub-limits so one model can run out while others keep working.
//
// Usage is derived from the UsageLog table (input + output tokens). Nothing is
// double-counted: the AI Router writes one UsageLog row per AI response.

import { db } from "@/lib/db";
import { estimateCost, getModelInfo, modelTokenLimit } from "@/lib/ai/model-catalog";
import type {
  AppTokenStats,
  ProviderName,
  WorkspaceBudget,
} from "@/types";

/** Compute the live token budget for a workspace from its UsageLog rows. */
export async function getWorkspaceBudget(
  workspaceId: string,
): Promise<WorkspaceBudget> {
  const [workspace, grouped] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId } }),
    db.usageLog.groupBy({
      by: ["model", "provider"],
      where: { workspaceId },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);

  const limit = workspace?.tokenLimit ?? 0;

  const perModel = grouped.map((g) => {
    const used = (g._sum.inputTokens ?? 0) + (g._sum.outputTokens ?? 0);
    const modelLimit = modelTokenLimit(g.model);
    return {
      provider: g.provider as ProviderName,
      model: g.model,
      label: getModelInfo(g.model)?.label ?? g.model,
      used,
      limit: modelLimit,
      exhausted: used >= modelLimit,
    };
  });

  const used = perModel.reduce((sum, m) => sum + m.used, 0);

  return {
    workspaceId,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    perModel: perModel.sort((a, b) => b.used - a.used),
  };
}

/** App-wide aggregate: total tokens used and the average per workspace. */
export async function getAppTokenStats(): Promise<AppTokenStats> {
  const [agg, workspaceCount] = await Promise.all([
    db.usageLog.aggregate({
      _sum: { inputTokens: true, outputTokens: true },
    }),
    db.workspace.count(),
  ]);

  const totalUsed =
    (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0);

  return {
    totalUsed,
    workspaceCount,
    averagePerWorkspace:
      workspaceCount > 0 ? Math.round(totalUsed / workspaceCount) : 0,
  };
}

/** Record one AI response's token usage (cost is derived from the catalog). */
export async function recordUsage(args: {
  userId?: string;
  workspaceId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  await db.usageLog.create({
    data: {
      userId: args.userId,
      workspaceId: args.workspaceId,
      provider: args.provider,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalCost: estimateCost(args.model, args.inputTokens, args.outputTokens),
    },
  });
}
