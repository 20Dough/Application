import { resolveMentions, type MentionableAgent } from "@/lib/chat/mention-parser";

// Agent selection — decides which agents respond to a message, given the room's
// agents and the message text. Pure (no database) so it can be unit-reasoned and
// reused. Implements the mention rules from PRODUCT_REQUIREMENTS (Feature 7):
//
//   1. One AI mentioned        → only that agent responds.
//   2. Multiple mentioned      → all mentioned agents respond.
//   3. No AI mention matched    → the room's default agent responds.
//   4. No default agent         → ARi responds.
//   5. A mentioned inactive agent does not respond.
//   6. A mentioned agent not in the room is ignored, with a clear system notice.
//   7. (provider failures are handled in the router, not here.)
//
// Note on collaboration: rules 3–4 only auto-respond from agents that are active
// members of the room. A room with no agents added stays pure human-to-human
// chat — no AI is forced into the conversation — which keeps Human ↔ Human a
// first-class interaction (a non-negotiable HiveMind principle).

// The ARi agent is the ultimate fallback responder (rule 4). Matched by handle.
const ARI_HANDLE = "ari";

/** Full agent shape selection needs (a superset of MentionableAgent). */
export type SelectableAgent = MentionableAgent & {
  provider: string;
  model: string;
  systemPrompt: string;
  isActive: boolean;
};

export type SelectionResult = {
  /** Agents that should generate a response, in selection order. */
  selected: SelectableAgent[];
  /** Human-readable system notices to save (e.g. mentioned-but-unavailable). */
  notices: string[];
};

/**
 * Selects the agents that should respond to `content`.
 *
 * @param content          The message text.
 * @param roomAgents       Agents that are members of the room (active or not).
 * @param workspaceAgents  All agents in the workspace, used only to explain a
 *                         mention that named a real agent who can't respond.
 * @param defaultAgentId   The room's default agent id, or null.
 */
export function selectRespondingAgents(params: {
  content: string;
  roomAgents: SelectableAgent[];
  workspaceAgents: SelectableAgent[];
  defaultAgentId: string | null;
}): SelectionResult {
  const { content, roomAgents, workspaceAgents, defaultAgentId } = params;

  const activeRoomAgents = roomAgents.filter((a) => a.isActive);
  const byId = new Map(activeRoomAgents.map((a) => [a.id, a]));

  // Resolve mentions against agents that can actually respond (active, in-room).
  const resolved = resolveMentions(content, activeRoomAgents);

  const notices: string[] = [];

  // Rules 1 & 2: explicitly mentioned active room agents respond.
  if (resolved.mentionedAgentIds.length > 0) {
    const selected = resolved.mentionedAgentIds
      .map((id) => byId.get(id))
      .filter((a): a is SelectableAgent => Boolean(a));
    addUnavailableNotices(resolved.unmatched, roomAgents, workspaceAgents, notices);
    return { selected, notices };
  }

  // No mention matched an active room agent. Explain any mention that named a
  // real-but-unavailable agent (rules 5 & 6) before deciding on a fallback.
  addUnavailableNotices(resolved.unmatched, roomAgents, workspaceAgents, notices);

  // If the message explicitly named a *known* AI agent (one that exists in the
  // workspace) who simply can't respond — inactive, or not in this room — we do
  // NOT fall back to a different agent. The user addressed someone specific; the
  // notices above explain why they're quiet. Rules 3–4 only apply when the
  // message contains no AI-agent mention at all.
  const namedKnownAgent =
    resolveMentions(content, workspaceAgents).mentionedAgentIds.length > 0;
  if (namedKnownAgent) {
    return { selected: [], notices };
  }

  // Rule 3: the room's default agent responds (if active and in the room).
  const defaultAgent = defaultAgentId
    ? activeRoomAgents.find((a) => a.id === defaultAgentId)
    : undefined;
  if (defaultAgent) {
    return { selected: [defaultAgent], notices };
  }

  // Rule 4: otherwise ARi responds (if active and in the room).
  const ari = activeRoomAgents.find((a) => a.name.toLowerCase() === ARI_HANDLE);
  if (ari) {
    return { selected: [ari], notices };
  }

  // No agent can respond. If the message named no agent at all, this is just
  // human-to-human chat (no notice). Otherwise the notices above explain why.
  return { selected: [], notices };
}

// For each handle that didn't match an active room agent, add a notice when it
// named a real workspace agent that is inactive or not in the room. Unknown
// handles (typos, future human mentions) are ignored silently.
function addUnavailableNotices(
  unmatchedHandles: string[],
  roomAgents: SelectableAgent[],
  workspaceAgents: SelectableAgent[],
  notices: string[]
): void {
  const inRoom = new Set(roomAgents.map((a) => a.id));
  for (const handle of unmatchedHandles) {
    const agent = workspaceAgents.find(
      (a) =>
        a.name.toLowerCase() === handle ||
        a.displayName.toLowerCase() === handle
    );
    if (!agent) continue;
    if (!inRoom.has(agent.id)) {
      notices.push(
        `${agent.displayName} isn't in this room yet — add them to let them respond.`
      );
    } else if (!agent.isActive) {
      notices.push(`${agent.displayName} is inactive and won't respond.`);
    }
  }
}
