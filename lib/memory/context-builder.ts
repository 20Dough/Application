// Context builder (Phase 9).
//
// Assembles the context string sent to an AI provider, following the strict
// priority order from ARCHITECTURE.md. ProjectContext always comes before
// MemoryItem. Never sends unlimited history — recent messages only.

import { db } from "@/lib/db";

const RECENT_MESSAGE_LIMIT = 30;

interface AttachmentContext {
  name: string;
  text: string;
}

interface BuildContextArgs {
  workspaceId: string;
  roomId: string;
  agentSystemPrompt: string;
  currentMessage: string;
  /**
   * Message id to exclude from "Recent Conversation" — typically the just-saved
   * human message, which is already shown separately as the current message.
   */
  excludeMessageId?: string;
  /** Pre-formatted web search results to give the agent fresh information. */
  webSearchBlock?: string;
  /** Parsed text of files attached to the current message. */
  attachments?: AttachmentContext[];
}

export async function buildContext({
  workspaceId,
  roomId,
  agentSystemPrompt,
  currentMessage,
  excludeMessageId,
  webSearchBlock,
  attachments,
}: BuildContextArgs): Promise<string> {
  const [workspace, room, projectContexts, memoryItems, decisions, recent] =
    await Promise.all([
      db.workspace.findUnique({ where: { id: workspaceId } }),
      db.room.findUnique({ where: { id: roomId } }),
      db.projectContext.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      }),
      db.memoryItem.findMany({
        where: { workspaceId },
        orderBy: { importance: "desc" },
        take: 10,
      }),
      db.decision.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.message.findMany({
        where: {
          roomId,
          ...(excludeMessageId ? { id: { not: excludeMessageId } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: RECENT_MESSAGE_LIMIT,
        include: { user: true, agent: true },
      }),
    ]);

  const lines: string[] = [];

  // 1. Agent system prompt
  lines.push(agentSystemPrompt, "");

  // 2. Project Context (before MemoryItem)
  if (projectContexts.length > 0) {
    lines.push("Project Context:");
    for (const ctx of projectContexts) {
      lines.push(`* ${ctx.title}: ${ctx.content}`);
    }
    lines.push("");
  }

  // 3. Workspace info
  if (workspace) {
    lines.push("Workspace:");
    lines.push(`Name: ${workspace.name}`);
    if (workspace.description)
      lines.push(`Description: ${workspace.description}`);
    lines.push("");
  }

  // 4. Room info
  if (room) {
    lines.push("Room:");
    lines.push(`Name: ${room.name}`);
    if (room.description) lines.push(`Description: ${room.description}`);
    lines.push("");
  }

  // 5. Important MemoryItems
  if (memoryItems.length > 0) {
    lines.push("Important Memory:");
    for (const item of memoryItems) {
      lines.push(`* ${item.title}: ${item.content}`);
    }
    lines.push("");
  }

  // 6. Recent Decisions
  if (decisions.length > 0) {
    lines.push("Recent Decisions:");
    for (const d of decisions) {
      lines.push(`* ${d.title}: ${d.summary}`);
    }
    lines.push("");
  }

  // 7. Recent Conversation (oldest → newest)
  if (recent.length > 0) {
    lines.push("Recent Conversation:");
    for (const m of [...recent].reverse()) {
      const who =
        m.senderType === "human"
          ? `Human ${m.user?.name ?? "User"}`
          : m.senderType === "agent"
            ? (m.agent?.displayName ?? "Agent")
            : "System";
      lines.push(`${who}: ${m.content}`);
    }
    lines.push("");
  }

  // 8. Attached files (parsed text of files on the current message)
  if (attachments && attachments.length > 0) {
    lines.push("Attached Files:");
    for (const a of attachments) {
      lines.push(`--- ${a.name} ---`);
      lines.push(a.text);
      lines.push("");
    }
  }

  // 9. Live web search results (when the message warranted a search)
  if (webSearchBlock) {
    lines.push(webSearchBlock, "");
  }

  // 10. Current message
  lines.push("Current Message:");
  lines.push(currentMessage);

  return lines.join("\n");
}
