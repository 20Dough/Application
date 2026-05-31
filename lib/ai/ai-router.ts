import { db } from "@/lib/db";
import type { Message, Room } from "@prisma/client";
import { getProvider } from "@/lib/ai/providers";
import {
  selectRespondingAgents,
  type SelectableAgent,
} from "@/lib/ai/agent-selection";
import { resolveMentions } from "@/lib/chat/mention-parser";
import {
  buildAgentContext,
  type ContextMessage,
} from "@/lib/memory/context-builder";
import {
  coerceDecisionFields,
  type DecisionFields,
} from "@/lib/decisions/validation";
import { retrieveKnowledge } from "@/lib/knowledge/retrieval";
import type { RetrievedKnowledge } from "@/lib/memory/context-builder";

// AI Router — the single place AI orchestration happens. The API route owns
// authentication, permission checks, and persisting the human message; the
// router takes that saved message and produces the AI side of the exchange:
//
//   load room/workspace/agents → parse mentions → select agents → build context
//   → call provider adapters → save AI responses → return them.
//
// Design guarantees (PRODUCT_REQUIREMENTS Feature 7 & 9):
//   - Multiple mentioned agents each respond (one provider call each).
//   - One provider failing never rolls back the human message or blocks the
//     other agents; the failed agent gets a user-safe system message instead.
//   - Raw provider errors are logged server-side only, never returned to clients.
//   - Message metadata records mentions and provenance so future AI↔AI and
//     AI↔Human routing can build on the same records.

// How an authored message is shaped for the client (mirrors the messages route).
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

const AGENT_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
} as const;

const REPLY_INCLUDE = {
  user: { select: USER_SELECT },
  agent: { select: AGENT_SELECT },
} as const;

// Recent messages pulled for context. The builder bounds this further; we fetch
// a small superset so the latest exchange is always present.
const CONTEXT_MESSAGE_LIMIT = 40;

type ReplyMessage = Message & {
  user: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  agent: { id: string; name: string; displayName: string; avatarUrl: string | null } | null;
};

/**
 * Generates and saves the AI replies (and any system notices) prompted by a
 * just-saved human message. Returns the saved reply messages, oldest → newest,
 * ready to hand back to the client. Returns an empty array when no agent should
 * respond (e.g. pure human-to-human chat in an agent-free room).
 */
export async function routeHumanMessage(
  room: Room,
  humanMessage: Message
): Promise<ReplyMessage[]> {
  // Replies gathered so far. Hoisted so the safety net below can still return
  // whatever was produced before an unexpected failure instead of losing it.
  const replies: ReplyMessage[] = [];

  // The human message is already persisted by the caller. The AI side must
  // degrade gracefully and never throw past this point: an unexpected failure
  // anywhere in the routing/provider path — a provider erroring, malformed or
  // non-JSON provider output, a context-load hiccup — must not turn
  // POST /api/rooms/[roomId]/messages into a 500. Per-agent provider failures
  // are already handled in generateAgentReply; this outer guard covers the
  // shared setup (agent loading, mention metadata, context/knowledge) and any
  // unforeseen throw, so a malformed AI exchange never fails the human's post.
  try {
    // --- Load the agents available in this room and the workspace --------
    const [roomAgentLinks, workspaceAgents] = await Promise.all([
      db.roomAgent.findMany({
        where: { roomId: room.id },
        include: { agent: true },
      }),
      db.agent.findMany({ where: { workspaceId: room.workspaceId } }),
    ]);

    const roomAgents: SelectableAgent[] = roomAgentLinks.map((link) =>
      toSelectable(link.agent)
    );
    const selectableWorkspaceAgents = workspaceAgents.map(toSelectable);

    // --- Select which agents respond, plus any user-facing notices -------
    const { selected, notices } = selectRespondingAgents({
      content: humanMessage.content,
      roomAgents,
      workspaceAgents: selectableWorkspaceAgents,
      defaultAgentId: room.defaultAgentId,
    });

    // Record the mention metadata on the human message (resolved against all
    // workspace agents so the record is accurate even for not-in-room mentions).
    await recordMentionMetadata(humanMessage, selectableWorkspaceAgents);

    // Nothing to do (and nothing to explain): pure human-to-human message.
    if (selected.length === 0 && notices.length === 0) {
      return replies;
    }

    // Save explanatory notices first so they precede any fallback response.
    for (const notice of notices) {
      replies.push(await saveSystemMessage(room.id, notice, humanMessage.id));
    }

    if (selected.length === 0) {
      return replies;
    }

    // --- Build shared context inputs, then call each provider ------------
    const contextMessages = await loadContextMessages(room.id);
    // Knowledge is retrieved once for the triggering message and shared by every
    // selected agent (they answer the same message in the same scope).
    const sharedSources = await loadSharedSources(room, humanMessage.content);

    for (const agent of selected) {
      const reply = await generateAgentReply(
        room,
        humanMessage,
        agent,
        contextMessages,
        sharedSources
      );
      replies.push(reply);
    }

    return replies;
  } catch (error) {
    // Last-resort degradation: the human message stands; the AI side simply
    // produced fewer (or no) replies this turn. Log the real error server-side
    // only — never surface it to the client as a 500.
    console.error(
      "[ai-router] routeHumanMessage failed; degrading gracefully:",
      error
    );
    return replies;
  }
}

// --- One agent's turn ------------------------------------------------------

async function generateAgentReply(
  room: Room,
  humanMessage: Message,
  agent: SelectableAgent,
  contextMessages: ContextMessage[],
  shared: SharedSources
): Promise<ReplyMessage> {
  try {
    const provider = getProvider(agent.provider);
    const context = buildAgentContext({
      agent: { id: agent.id, systemPrompt: agent.systemPrompt },
      workspace: shared.workspace,
      room: { name: room.name, description: room.description },
      projectContexts: shared.projectContexts,
      memoryItems: shared.memoryItems,
      decisions: shared.decisions,
      knowledge: shared.knowledge,
      messages: contextMessages,
    });

    const result = await provider.generateResponse({
      model: agent.model,
      systemPrompt: context.systemPrompt,
      messages: context.messages,
    });

    const content = result.content.trim();
    if (!content) {
      throw new Error("Provider returned an empty response");
    }

    // Best-effort usage logging; never let it break the reply.
    await logUsage(room, humanMessage, agent, result.inputTokens, result.outputTokens);

    return saveAgentMessage(room.id, agent, content, {
      provider: agent.provider,
      model: agent.model,
      triggeredByMessageId: humanMessage.id,
      mentionType: "human_to_ai",
    });
  } catch (error) {
    // Degrade gracefully: this agent couldn't respond, but the human message and
    // the other agents are unaffected. Log the real error server-side only.
    console.error(
      `[ai-router] ${agent.displayName} (${agent.provider}/${agent.model}) failed:`,
      error
    );
    return saveSystemMessage(
      room.id,
      `${agent.displayName} could not respond right now.`,
      humanMessage.id,
      { agentId: agent.id }
    );
  }
}

// --- Persistence helpers ---------------------------------------------------

function saveAgentMessage(
  roomId: string,
  agent: SelectableAgent,
  content: string,
  metadata: Record<string, unknown>
): Promise<ReplyMessage> {
  return db.message.create({
    data: {
      roomId,
      senderType: "agent",
      agentId: agent.id,
      content,
      metadata: JSON.stringify(metadata),
    },
    include: REPLY_INCLUDE,
  });
}

function saveSystemMessage(
  roomId: string,
  content: string,
  triggeredByMessageId: string,
  extra: Record<string, unknown> = {}
): Promise<ReplyMessage> {
  return db.message.create({
    data: {
      roomId,
      senderType: "system",
      content,
      metadata: JSON.stringify({ system: true, triggeredByMessageId, ...extra }),
    },
    include: REPLY_INCLUDE,
  });
}

async function recordMentionMetadata(
  humanMessage: Message,
  workspaceAgents: SelectableAgent[]
): Promise<void> {
  const resolved = resolveMentions(humanMessage.content, workspaceAgents);
  // Skip the write when the message had no mentions and none was recorded before.
  if (resolved.rawMentions.length === 0 && !humanMessage.metadata) return;
  await db.message.update({
    where: { id: humanMessage.id },
    data: {
      metadata: JSON.stringify({
        mentionedAgentIds: resolved.mentionedAgentIds,
        mentionedUserIds: resolved.mentionedUserIds,
        rawMentions: resolved.rawMentions,
      }),
    },
  });
}

async function logUsage(
  room: Room,
  humanMessage: Message,
  agent: SelectableAgent,
  inputTokens?: number,
  outputTokens?: number
): Promise<void> {
  try {
    await db.usageLog.create({
      data: {
        userId: humanMessage.userId,
        workspaceId: room.workspaceId,
        provider: agent.provider,
        model: agent.model,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
      },
    });
  } catch (error) {
    console.error("[ai-router] usage logging failed:", error);
  }
}

// --- Context loading -------------------------------------------------------

type SharedSources = {
  workspace: { name: string; description: string | null };
  projectContexts: Array<{ title: string; content: string }>;
  memoryItems: Array<{ title: string; content: string; importance: number }>;
  decisions: Array<{ title: string; summary: string }>;
  knowledge: RetrievedKnowledge[];
};

async function loadSharedSources(
  room: Room,
  query: string
): Promise<SharedSources> {
  const [workspace, projectContexts, memoryItems, decisions, knowledge] = await Promise.all([
    db.workspace.findUniqueOrThrow({
      where: { id: room.workspaceId },
      select: { name: true, description: true },
    }),
    db.projectContext.findMany({
      where: { workspaceId: room.workspaceId },
      select: { title: true, content: true },
      orderBy: { createdAt: "asc" },
    }),
    db.memoryItem.findMany({
      where: {
        workspaceId: room.workspaceId,
        OR: [{ roomId: null }, { roomId: room.id }],
      },
      select: { title: true, content: true, importance: true },
      orderBy: { importance: "desc" },
    }),
    db.decision.findMany({
      where: {
        workspaceId: room.workspaceId,
        OR: [{ roomId: null }, { roomId: room.id }],
      },
      select: { title: true, summary: true },
      orderBy: { createdAt: "desc" },
    }),
    loadRelevantKnowledge(room, query),
  ]);
  return { workspace, projectContexts, memoryItems, decisions, knowledge };
}

// Retrieves knowledge passages relevant to the triggering message, scoped to the
// room (workspace-wide + this room's sources). Retrieval is best-effort: an
// embedding/db hiccup must never block the AI replies, so failures degrade to
// "no knowledge" and are logged server-side only.
async function loadRelevantKnowledge(
  room: Room,
  query: string
): Promise<RetrievedKnowledge[]> {
  try {
    const chunks = await retrieveKnowledge({
      workspaceId: room.workspaceId,
      roomId: room.id,
      query,
    });
    return chunks.map((c) => ({ sourceTitle: c.sourceTitle, content: c.content }));
  } catch (error) {
    console.error("[ai-router] knowledge retrieval failed:", error);
    return [];
  }
}

async function loadContextMessages(roomId: string): Promise<ContextMessage[]> {
  const recent = await db.message.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: CONTEXT_MESSAGE_LIMIT,
    select: {
      senderType: true,
      content: true,
      agentId: true,
      user: { select: { name: true, email: true } },
      agent: { select: { displayName: true } },
    },
  });
  return recent.reverse();
}

function toSelectable(agent: {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  model: string;
  systemPrompt: string;
  isActive: boolean;
}): SelectableAgent {
  return {
    id: agent.id,
    name: agent.name,
    displayName: agent.displayName,
    provider: agent.provider,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    isActive: agent.isActive,
  };
}

// ===========================================================================
// Decision summaries
// ===========================================================================
//
// Generating a decision summary reuses the same AI orchestration the chat loop
// uses — select an agent, build context, call its provider through the factory,
// degrade gracefully — but produces a structured Decision instead of a chat
// reply. The API route owns auth/permissions and persists the returned draft.

// How many of the room's most recent messages feed the summary.
const SUMMARY_MESSAGE_LIMIT = 30;

/** A generated, not-yet-persisted decision plus its provenance. */
export type DecisionSummaryDraft = DecisionFields & {
  agentId: string;
  provider: string;
  model: string;
};

/**
 * Raised when a decision summary can't be produced for an expected reason the
 * caller should see (no messages yet, no agent available, the provider failed).
 * The route maps this to a 4xx with the message; unexpected errors stay 500.
 */
export class DecisionSummaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionSummaryError";
  }
}

/**
 * Generates a decision summary from a room's recent messages. Picks the author
 * agent (explicit → room default → first active workspace agent), builds a
 * summarization prompt from the transcript, and calls that agent's provider.
 * Returns a bounded draft; the caller persists it. Throws DecisionSummaryError
 * for user-facing failures and logs raw provider errors server-side only.
 */
export async function generateDecisionSummary(
  room: Room,
  options: { agentId?: string | null } = {}
): Promise<DecisionSummaryDraft> {
  const messages = await loadContextMessages(room.id);
  const conversation = messages.filter((m) => m.senderType !== "system");
  if (conversation.length === 0) {
    throw new DecisionSummaryError(
      "There are no messages in this room to summarize yet."
    );
  }

  const agent = await selectSummaryAgent(room, options.agentId ?? null);

  const transcript = conversation
    .slice(-SUMMARY_MESSAGE_LIMIT)
    .map((m) => `${summarySpeaker(m)}: ${m.content}`)
    .join("\n");

  let content: string;
  try {
    const provider = getProvider(agent.provider);
    const result = await provider.generateResponse({
      model: agent.model,
      systemPrompt: buildDecisionPrompt(agent.displayName, room.name),
      messages: [{ role: "user", content: transcript }],
    });
    content = result.content.trim();
    if (!content) {
      throw new Error("Provider returned an empty summary");
    }
  } catch (error) {
    console.error(
      `[ai-router] decision summary via ${agent.displayName} (${agent.provider}/${agent.model}) failed:`,
      error
    );
    throw new DecisionSummaryError(
      "The AI teammate could not generate a summary right now. Please try again."
    );
  }

  const fields = parseDecisionContent(content);
  return { ...fields, agentId: agent.id, provider: agent.provider, model: agent.model };
}

// Picks the agent that authors the summary. An explicit agentId must be an
// active agent in this workspace; otherwise the room's default agent is used,
// falling back to the first active workspace agent.
async function selectSummaryAgent(
  room: Room,
  requestedAgentId: string | null
): Promise<SelectableAgent> {
  if (requestedAgentId) {
    const agent = await db.agent.findFirst({
      where: { id: requestedAgentId, workspaceId: room.workspaceId },
    });
    if (!agent) {
      throw new DecisionSummaryError("That agent is not part of this workspace.");
    }
    if (!agent.isActive) {
      throw new DecisionSummaryError(`${agent.displayName} is inactive.`);
    }
    return toSelectable(agent);
  }

  if (room.defaultAgentId) {
    const fallback = await db.agent.findFirst({
      where: { id: room.defaultAgentId, workspaceId: room.workspaceId, isActive: true },
    });
    if (fallback) return toSelectable(fallback);
  }

  const anyActive = await db.agent.findFirst({
    where: { workspaceId: room.workspaceId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!anyActive) {
    throw new DecisionSummaryError(
      "No active AI teammate is available to generate a summary."
    );
  }
  return toSelectable(anyActive);
}

function buildDecisionPrompt(agentName: string, roomName: string): string {
  return (
    `You are ${agentName}, an AI teammate in HiveMind. Read the recent ` +
    `conversation from the room "${roomName}" and produce a concise DECISION ` +
    `SUMMARY: the key decision(s) the team reached or converged on, plus the ` +
    `concrete next steps.\n\n` +
    `Respond with ONLY a JSON object of this exact shape:\n` +
    `{"title": "...", "summary": "...", "actionItems": ["...", "..."]}\n\n` +
    `- title: a short headline naming the decision or topic.\n` +
    `- summary: 1-3 sentences on what was decided and why.\n` +
    `- actionItems: array of short next-step strings (use [] if there are none).\n` +
    `Do not include any prose, markdown, or text outside the JSON object.`
  );
}

// Parses the provider output into bounded decision fields. Prefers a JSON object
// (optionally fenced); when the model — or the dev stub — returns plain text, it
// falls back to using that text as the summary so a Decision is still produced.
function parseDecisionContent(content: string): DecisionFields {
  const json = extractJsonObject(content);
  if (json) {
    return coerceDecisionFields({
      title: json.title,
      summary: json.summary,
      actionItems: json.actionItems,
    });
  }
  // Plain-text fallback: first line becomes the title, the whole reply the summary.
  const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean);
  return coerceDecisionFields({
    title: firstLine,
    summary: content,
    actionItems: [],
  });
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  // Strip a ```json … ``` (or plain ``` … ```) fence if present.
  const unfenced = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function summarySpeaker(message: ContextMessage): string {
  if (message.senderType === "agent") {
    return message.agent?.displayName ?? "Agent";
  }
  return message.user?.name || message.user?.email || "Someone";
}
