// AI Router (Phase 7) — the ONLY place where AI orchestration happens.
//
// Flow: receive (roomId, userId, content) → save human message → guard the
// workspace token pool → optionally run a web search → pick the responding
// agent(s) → swap out any token-exhausted models → build context → call
// provider adapters → save AI responses + log token usage → return them.
//
// Agent selection (when the user did NOT @mention anyone) is delegated to the
// cheapest active model acting as a lightweight router, so we don't spend tokens
// having every agent answer at once.
//
// Per the architecture rules: if one provider fails, the others still respond
// and the whole request is not rolled back.

import { db } from "@/lib/db";
import { parseMentions } from "@/lib/chat/mention-parser";
import { buildContext } from "@/lib/memory/context-builder";
import { getProvider } from "@/lib/ai/provider-factory";
import { serializeMessage } from "@/lib/serialize";
import { modelCostWeight } from "@/lib/ai/model-catalog";
import { estimateTokens } from "@/lib/tokens/tokenizer";
import { getWorkspaceBudget, recordUsage } from "@/lib/tokens/budget";
import {
  shouldSearch,
  webSearch,
  formatSearchResults,
} from "@/lib/ai/tools/web-search";
import type { Agent as AgentType, Message, MessageMetadata } from "@/types";

const messageInclude = { user: true, agent: true } as const;

interface RouteMessageArgs {
  roomId: string;
  userId: string;
  content: string;
  attachmentIds?: string[];
}

export interface RouteResult {
  humanMessage: Message;
  agentMessages: Message[];
}

export async function routeMessage({
  roomId,
  userId,
  content,
  attachmentIds = [],
}: RouteMessageArgs): Promise<RouteResult> {
  // Load room + workspace
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error("Room not found");

  // Active agents that belong to this room
  const roomAgents = await db.roomAgent.findMany({
    where: { roomId },
    include: { agent: true },
  });
  const activeAgents = roomAgents
    .map((ra) => ra.agent)
    .filter((a) => a.isActive);

  // Extract mentions against active room agents
  const { mentionedAgentIds, rawMentions } = parseMentions(
    content,
    activeAgents,
  );

  // Save the human message (with mention + attachment metadata)
  const humanMeta: MessageMetadata = {
    mentionedAgentIds,
    rawMentions,
    ...(attachmentIds.length ? { attachmentIds } : {}),
  };
  const humanRow = await db.message.create({
    data: {
      roomId,
      senderType: "human",
      userId,
      content,
      metadata: JSON.stringify(humanMeta),
    },
    include: messageInclude,
  });
  const humanMessage = serializeMessage(humanRow);

  // Link any uploaded attachments to the message just created.
  if (attachmentIds.length) {
    await db.attachment.updateMany({
      where: { id: { in: attachmentIds }, roomId },
      data: { messageId: humanMessage.id },
    });
  }

  const saveSystem = async (text: string, meta?: MessageMetadata) => {
    const row = await db.message.create({
      data: {
        roomId,
        senderType: "system",
        content: text,
        ...(meta ? { metadata: JSON.stringify(meta) } : {}),
      },
      include: messageInclude,
    });
    return serializeMessage(row);
  };

  // --- Token pool guard (shared per workspace) ---
  const budget = await getWorkspaceBudget(room.workspaceId);
  if (budget.remaining <= 0) {
    return {
      humanMessage,
      agentMessages: [
        await saveSystem(
          "This workspace has used up its shared token pool. An admin can raise the limit to keep chatting with AI teammates.",
          { error: "token_pool_exhausted" },
        ),
      ],
    };
  }
  const exhaustedModels = new Set(
    budget.perModel.filter((m) => m.exhausted).map((m) => m.model),
  );

  // --- Pick the responding agent(s) ---
  const { targets, selectedBy } = await resolveTargets({
    content,
    activeAgents,
    mentionedAgentIds,
    defaultAgentId: room.defaultAgentId,
    workspaceId: room.workspaceId,
    userId,
  });

  if (targets.length === 0) {
    return {
      humanMessage,
      agentMessages: [
        await saveSystem(
          "No active AI agent is available to respond in this room.",
        ),
      ],
    };
  }

  // Swap out any agent whose model has exhausted its token budget.
  const plan = applyExhaustionFallback(targets, activeAgents, exhaustedModels);

  // Gather the web search (when warranted) and attachment text concurrently —
  // they're independent and both feed the agents' context.
  const usedWebSearch = shouldSearch(content);
  const [searchOut, attachments] = await Promise.all([
    usedWebSearch ? webSearch(content) : Promise.resolve(null),
    loadAttachmentContexts(attachmentIds, roomId),
  ]);
  const webSearchBlock = searchOut ? formatSearchResults(searchOut) : undefined;

  // Generate all responses in parallel; isolate failures so one bad provider
  // never blocks or rolls back the others.
  const results = new Map<
    string,
    { ok: true; text: string; inputTokens: number } | { ok: false }
  >();
  await Promise.all(
    plan
      .filter((p) => !p.exhaustedNoRepl)
      .map(async (p) => {
        try {
          const systemContext = await buildContext({
            workspaceId: room.workspaceId,
            roomId,
            agentSystemPrompt: p.agent.systemPrompt,
            currentMessage: content,
            excludeMessageId: humanMessage.id,
            webSearchBlock,
            attachments,
          });
          const inputTokens =
            estimateTokens(systemContext) + estimateTokens(content);
          const text = await getProvider(p.agent.provider).generateResponse({
            model: p.agent.model,
            systemPrompt: systemContext,
            messages: [{ role: "user", content }],
          });
          results.set(p.agent.id, { ok: true, text, inputTokens });
        } catch (err) {
          console.error(`[ai-router] agent ${p.agent.name} failed:`, err);
          results.set(p.agent.id, { ok: false });
        }
      }),
  );

  // Assemble messages in plan order, interleaving exhaustion notices.
  const agentMessages: Message[] = [];
  for (const p of plan) {
    if (p.exhaustedNoRepl) {
      agentMessages.push(
        await saveSystem(
          `⚠️ ${p.agent.displayName} (${p.agent.model}) has used up its token budget and no alternative model is available right now.`,
          { error: "model_exhausted" },
        ),
      );
      continue;
    }

    if (p.replacedFrom) {
      agentMessages.push(
        await saveSystem(
          `⚠️ ${p.replacedFrom.displayName} (${p.replacedFrom.model}) is out of tokens — ${p.agent.displayName} is answering instead.`,
          { error: "model_exhausted_fallback" },
        ),
      );
    }

    const result = results.get(p.agent.id);
    if (result?.ok) {
      const outputTokens = estimateTokens(result.text);
      const meta: MessageMetadata = {
        provider: p.agent.provider as AgentType["provider"],
        model: p.agent.model,
        mentionType: "human-to-ai",
        triggeredByMessageId: humanMessage.id,
        selectedBy,
        inputTokens: result.inputTokens,
        outputTokens,
        ...(usedWebSearch ? { usedWebSearch: true } : {}),
      };
      const row = await db.message.create({
        data: {
          roomId,
          senderType: "agent",
          agentId: p.agent.id,
          content: result.text,
          metadata: JSON.stringify(meta),
        },
        include: messageInclude,
      });
      agentMessages.push(serializeMessage(row));

      await recordUsage({
        userId,
        workspaceId: room.workspaceId,
        provider: p.agent.provider,
        model: p.agent.model,
        inputTokens: result.inputTokens,
        outputTokens,
      });
    } else {
      agentMessages.push(
        await saveSystem(
          `${p.agent.displayName} could not respond right now.`,
          {
            error: "provider_failed",
          },
        ),
      );
    }
  }

  return { humanMessage, agentMessages };
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

async function loadAttachmentContexts(attachmentIds: string[], roomId: string) {
  if (!attachmentIds.length) return [];
  const rows = await db.attachment.findMany({
    where: { id: { in: attachmentIds }, roomId },
  });
  return rows.map((a) => ({ name: a.name, text: a.extractedText }));
}

// ---------------------------------------------------------------------------
// Target resolution: mention → cheapest-model selector → default fallback
// ---------------------------------------------------------------------------

interface ResolveArgs {
  content: string;
  activeAgents: SelectableAgent[];
  mentionedAgentIds: string[];
  defaultAgentId: string | null;
  workspaceId: string;
  userId: string;
}

async function resolveTargets({
  content,
  activeAgents,
  mentionedAgentIds,
  defaultAgentId,
  workspaceId,
  userId,
}: ResolveArgs): Promise<{ targets: SelectableAgent[]; selectedBy: string }> {
  // Explicit @mentions always win.
  if (mentionedAgentIds.length > 0) {
    return {
      targets: selectAgents({
        mentionedAgentIds,
        activeAgents,
        defaultAgentId,
      }),
      selectedBy: "mention",
    };
  }

  if (activeAgents.length === 0) return { targets: [], selectedBy: "none" };
  if (activeAgents.length === 1) {
    return { targets: activeAgents, selectedBy: "only-agent" };
  }

  // No mention + multiple agents: let the cheapest model decide who answers.
  const selector = cheapestAgent(activeAgents);
  const fallback = selectAgents({
    mentionedAgentIds: [],
    activeAgents,
    defaultAgentId,
  });

  try {
    const roster = activeAgents
      .map((a) => `- ${a.displayName} (handle: ${a.name}): ${a.role}`)
      .join("\n");
    const systemPrompt = [
      "You are a routing assistant for a team chat with several AI teammates.",
      "Given the user's message, choose the SINGLE teammate best suited to answer.",
      'Reply with ONLY that teammate\'s handle (the value after "handle:"), nothing else.',
      "",
      "Teammates:",
      roster,
    ].join("\n");

    const raw = await getProvider(selector.provider).generateResponse({
      model: selector.model,
      systemPrompt,
      messages: [{ role: "user", content }],
    });

    await recordUsage({
      userId,
      workspaceId,
      provider: selector.provider,
      model: selector.model,
      inputTokens: estimateTokens(systemPrompt) + estimateTokens(content),
      outputTokens: estimateTokens(raw),
    });

    const picked = matchAgentFromText(raw, activeAgents);
    if (picked) {
      return {
        targets: [picked],
        selectedBy: `selector:${selector.displayName}`,
      };
    }
  } catch (err) {
    console.error("[ai-router] selector failed:", err);
  }

  // Selector couldn't decide → default agent / ARi / cheapest.
  return {
    targets: fallback.length > 0 ? fallback : [selector],
    selectedBy: "selector-fallback",
  };
}

/** Find the agent whose handle or name appears in free-text selector output. */
function matchAgentFromText(
  text: string,
  agents: SelectableAgent[],
): SelectableAgent | null {
  const lower = text.toLowerCase();
  return (
    agents.find(
      (a) =>
        lower.includes(a.name.toLowerCase()) ||
        lower.includes(a.displayName.toLowerCase()),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Per-model exhaustion fallback
// ---------------------------------------------------------------------------

interface PlanEntry {
  agent: SelectableAgent;
  /** Set when this agent replaced another whose model was exhausted. */
  replacedFrom?: SelectableAgent;
  /** Set when the agent's model is exhausted and no replacement exists. */
  exhaustedNoRepl?: boolean;
}

/** Replace target agents whose model is exhausted with the cheapest open one. */
export function applyExhaustionFallback(
  targets: SelectableAgent[],
  activeAgents: SelectableAgent[],
  exhaustedModels: Set<string>,
): PlanEntry[] {
  const used = new Set(targets.map((t) => t.id));
  const plan: PlanEntry[] = [];

  for (const target of targets) {
    if (!exhaustedModels.has(target.model)) {
      plan.push({ agent: target });
      continue;
    }
    const replacement = activeAgents
      .filter((a) => !exhaustedModels.has(a.model) && !used.has(a.id))
      .sort((a, b) => modelCostWeight(a.model) - modelCostWeight(b.model))[0];

    if (replacement) {
      used.add(replacement.id);
      plan.push({ agent: replacement, replacedFrom: target });
    } else {
      plan.push({ agent: target, exhaustedNoRepl: true });
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Agent selection logic (ARCHITECTURE.md) — pure & synchronous
// ---------------------------------------------------------------------------

export type SelectableAgent = {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  model: string;
  role: string;
  systemPrompt: string;
  isActive: boolean;
};

interface SelectArgs {
  mentionedAgentIds: string[];
  activeAgents: SelectableAgent[];
  defaultAgentId: string | null;
}

export function selectAgents({
  mentionedAgentIds,
  activeAgents,
  defaultAgentId,
}: SelectArgs): SelectableAgent[] {
  // 1–3. Mentioned active agents win.
  if (mentionedAgentIds.length > 0) {
    return activeAgents.filter((a) => mentionedAgentIds.includes(a.id));
  }

  // 4. Fall back to the room's default agent (if active).
  if (defaultAgentId) {
    const def = activeAgents.find((a) => a.id === defaultAgentId);
    if (def) return [def];
  }

  // 5. Fall back to ARi if present and active.
  const ari = activeAgents.find((a) => a.name.toLowerCase() === "ari");
  if (ari) return [ari];

  // 7. Nothing valid.
  return [];
}

/** The active agent running the cheapest model (used as the routing selector). */
export function cheapestAgent<T extends { model: string }>(agents: T[]): T {
  return [...agents].sort(
    (a, b) => modelCostWeight(a.model) - modelCostWeight(b.model),
  )[0];
}
