// Shared client-side types for the room chat UI.
//
// These mirror the shape returned by GET /api/rooms/[roomId]/messages. A
// message is authored by a human (user populated), an AI agent (agent
// populated — supported in the schema and rendered here, though AI responses
// are not generated until a later phase), or the system (both null).

export type MessageSenderType = "human" | "agent" | "system";

export type MessageUser = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export type MessageAgent = {
  id: string;
  name: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderType: MessageSenderType;
  content: string;
  // JSON string set by the AI Router (mentions on human messages; provider/model
  // and provenance on agent messages). Parsed lazily by the UI when present.
  metadata: string | null;
  createdAt: string;
  user: MessageUser | null;
  agent: MessageAgent | null;
};

/** Shape of the agent-message metadata the UI reads (all fields optional). */
export type AgentMessageMetadata = {
  provider?: string;
  model?: string;
};

/** Safely parses message metadata; returns null on missing/invalid JSON. */
export function parseMetadata(metadata: string | null): AgentMessageMetadata | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as AgentMessageMetadata;
  } catch {
    return null;
  }
}
