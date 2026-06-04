import { describe, it, expect } from "vitest";
import {
  getWorkspaceBudget,
  getAppTokenStats,
  recordUsage,
} from "@/lib/tokens/budget";
import { db } from "@/lib/db";
import { createWorkspaceFixture } from "@/test/factories";

describe("getWorkspaceBudget", () => {
  it("sums usage, computes remaining, and breaks down by model", async () => {
    const { workspace, owner } = await createWorkspaceFixture();
    await recordUsage({
      userId: owner.id,
      workspaceId: workspace.id,
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1000,
      outputTokens: 500,
    });

    const budget = await getWorkspaceBudget(workspace.id);
    expect(budget.used).toBe(1500);
    expect(budget.limit).toBe(2000000); // schema default pool
    expect(budget.remaining).toBe(2000000 - 1500);

    const gpt = budget.perModel.find((m) => m.model === "gpt-4o");
    expect(gpt?.used).toBe(1500);
    expect(gpt?.exhausted).toBe(false);
  });

  it("flags a model as exhausted once it crosses its per-model cap", async () => {
    const { workspace } = await createWorkspaceFixture();
    // gpt-4o cap is 600k; push usage over it.
    await db.usageLog.create({
      data: {
        workspaceId: workspace.id,
        provider: "openai",
        model: "gpt-4o",
        inputTokens: 500000,
        outputTokens: 200000,
      },
    });

    const budget = await getWorkspaceBudget(workspace.id);
    const gpt = budget.perModel.find((m) => m.model === "gpt-4o");
    expect(gpt?.exhausted).toBe(true);
  });
});

describe("getAppTokenStats", () => {
  it("aggregates total usage and averages across workspaces", async () => {
    const a = await createWorkspaceFixture();
    const b = await createWorkspaceFixture();
    await recordUsage({
      workspaceId: a.workspace.id,
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 100,
      outputTokens: 100,
    });
    await recordUsage({
      workspaceId: b.workspace.id,
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 300,
      outputTokens: 100,
    });

    const stats = await getAppTokenStats();
    expect(stats.totalUsed).toBe(600);
    expect(stats.workspaceCount).toBe(2);
    expect(stats.averagePerWorkspace).toBe(300);
  });
});
