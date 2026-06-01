// AI Router (Phase 7) — the ONLY place where AI orchestration happens.
//
// Flow: receive (roomId, userId, content) → save human message → load room,
// workspace, active room agents → extract mentions → select target agents →
// build context → call provider adapters → save AI responses → return them.
//
// Per the architecture rules: if one provider fails, the others still respond
// and the whole request is not rolled back.

import { db } from "@/lib/db";
import { parseMentions } from "@/lib/chat/mention-parser";
import { buildContext } from "@/lib/memory/context-builder";
import { getProvider } from "@/lib/ai/provider-factory";
import { serializeMessage } from "@/lib/serialize";
import type { Agent as AgentType, Message, MessageMetadata } from "@/types";

const messageInclude = { user: true, agent: true } as const;

interface RouteMessageArgs {
  roomId: string;
  userId: string;
  content: string;
}

export interface RouteResult {
  humanMessage: Message;
  agentMessages: Message[];
}

export async function routeMessage({
  roomId,
  userId,
  content,
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
  const { mentionedAgentIds, rawMentions } = parseMentions(content, activeAgents);

  // Save the human message (with mention metadata)
  const humanMeta: MessageMetadata = { mentionedAgentIds, rawMentions };
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

  // Select target agents
  const targets = selectAgents({
    mentionedAgentIds,
    activeAgents,
    defaultAgentId: room.defaultAgentId,
  });

  // No valid agent → save a system message and return
  if (targets.length === 0) {
    const sysRow = await db.message.create({
      data: {
        roomId,
        senderType: "system",
        content: "No active AI agent is available to respond in this room.",
      },
      include: messageInclude,
    });
    return { humanMessage, agentMessages: [serializeMessage(sysRow)] };
  }

  // Call all providers in parallel. allSettled isolates failures so one
  // provider erroring out never blocks or rolls back the others.
  // The just-saved human message is excluded from context (it's the current
  // message, sent separately) so the model doesn't see it twice.
  const settled = await Promise.allSettled(
    targets.map(async (agent) => {
      const systemContext = await buildContext({
        workspaceId: room.workspaceId,
        roomId,
        agentSystemPrompt: agent.systemPrompt,
        currentMessage: content,
        excludeMessageId: humanMessage.id,
      });
      const provider = getProvider(agent.provider);
      return provider.generateResponse({
        model: agent.model,
        systemPrompt: systemContext,
        messages: [{ role: "user", content }],
      });
    }),
  );

  // Persist results in the original target order so createdAt stays stable.
  const agentMessages: Message[] = [];
  for (let i = 0; i < targets.length; i++) {
    const agent = targets[i];
    const result = settled[i];

    if (result.status === "fulfilled") {
      const meta: MessageMetadata = {
        provider: agent.provider as AgentType["provider"],
        model: agent.model,
        mentionType: "human-to-ai",
        triggeredByMessageId: humanMessage.id,
      };
      const row = await db.message.create({
        data: {
          roomId,
          senderType: "agent",
          agentId: agent.id,
          content: result.value,
          metadata: JSON.stringify(meta),
        },
        include: messageInclude,
      });
      agentMessages.push(serializeMessage(row));

      // Best-effort usage log
      await db.usageLog.create({
        data: {
          userId,
          workspaceId: room.workspaceId,
          provider: agent.provider,
          model: agent.model,
        },
      });
    } else {
      // Log raw error server-side only; show a friendly system message.
      console.error(`[ai-router] agent ${agent.name} failed:`, result.reason);
      const sysRow = await db.message.create({
        data: {
          roomId,
          senderType: "system",
          content: `${agent.displayName} could not respond right now.`,
          metadata: JSON.stringify({ error: "provider_failed" }),
        },
        include: messageInclude,
      });
      agentMessages.push(serializeMessage(sysRow));
    }
  }

  return { humanMessage, agentMessages };
}

// ---------------------------------------------------------------------------
// Agent selection logic (ARCHITECTURE.md)
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
