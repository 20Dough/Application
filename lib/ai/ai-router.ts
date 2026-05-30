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
  // --- Load the agents available in this room and the workspace ----------
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

  // --- Select which agents respond, plus any user-facing notices ---------
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
    return [];
  }

  const replies: ReplyMessage[] = [];

  // Save explanatory notices first so they precede any fallback response.
  for (const notice of notices) {
    replies.push(await saveSystemMessage(room.id, notice, humanMessage.id));
  }

  if (selected.length === 0) {
    return replies;
  }

  // --- Build shared context inputs, then call each provider --------------
  const contextMessages = await loadContextMessages(room.id);
  const sharedSources = await loadSharedSources(room);

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
};

async function loadSharedSources(room: Room): Promise<SharedSources> {
  const [workspace, projectContexts, memoryItems, decisions] = await Promise.all([
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
  ]);
  return { workspace, projectContexts, memoryItems, decisions };
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
