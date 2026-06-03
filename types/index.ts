// HiveMind shared domain types.
//
// These mirror the Prisma models but stay decoupled from the database layer so
// they can be used freely in client components (which must never import Prisma).

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type SenderType = "human" | "agent" | "system";

export type ProviderName = "openai" | "anthropic" | "gemini";

export type InvitationStatus = "pending" | "accepted" | "rejected";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  createdAt: string;
  user?: User;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  createdAt: string;
}

export interface Room {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  defaultAgentId?: string | null;
  createdById?: string | null;
  /** True when the room is passcode-protected. The hash itself is never sent. */
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  workspaceId: string;
  name: string;
  displayName: string;
  provider: ProviderName;
  model: string;
  role: string;
  systemPrompt: string;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoomAgent {
  id: string;
  roomId: string;
  agentId: string;
  createdAt: string;
  agent?: Agent;
}

/**
 * Structured metadata attached to a message. Stored as a JSON string in the
 * database (Message.metadata) but typed here for use across the app. Designed
 * to support future AI-to-AI delegation.
 */
export interface MessageMetadata {
  mentionedAgentIds?: string[];
  mentionedUserIds?: string[];
  rawMentions?: string[];
  provider?: ProviderName;
  model?: string;
  error?: string;
  triggeredByAgentId?: string;
  triggeredByMessageId?: string;
  autoInvoked?: boolean;
  mentionType?: "human-to-ai" | "human-to-human" | "ai-to-human" | "ai-to-ai";
  /** How the responding agent was chosen when no explicit @mention was given. */
  selectedBy?: string;
  /** Token usage for this AI response. */
  inputTokens?: number;
  outputTokens?: number;
  /** Whether a web search was run to help answer. */
  usedWebSearch?: boolean;
  /** Attachment ids referenced by a human message. */
  attachmentIds?: string[];
}

export interface Attachment {
  id: string;
  roomId: string;
  messageId?: string | null;
  name: string;
  mimeType: string;
  size: number;
  /** Parsed text content (may be truncated for display). */
  extractedText?: string;
  createdAt: string;
}

// --- Token budget (shared workspace pool) ---

export interface ModelUsage {
  provider: ProviderName;
  model: string;
  label: string;
  used: number;
  limit: number;
  exhausted: boolean;
}

export interface WorkspaceBudget {
  workspaceId: string;
  limit: number;
  used: number;
  remaining: number;
  perModel: ModelUsage[];
}

export interface AppTokenStats {
  totalUsed: number;
  workspaceCount: number;
  averagePerWorkspace: number;
}

export interface TokenInfo {
  workspace: WorkspaceBudget;
  app: AppTokenStats;
}

export interface Message {
  id: string;
  roomId: string;
  senderType: SenderType;
  userId?: string | null;
  agentId?: string | null;
  content: string;
  metadata?: MessageMetadata | null;
  createdAt: string;
  // Convenience fields hydrated for the UI.
  senderName?: string;
  agentRole?: string;
}

export interface MemoryItem {
  id: string;
  workspaceId: string;
  roomId?: string | null;
  title: string;
  content: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContext {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  workspaceId: string;
  roomId?: string | null;
  title: string;
  summary: string;
  actionItems?: string[];
  createdAt: string;
}

export interface UsageLog {
  id: string;
  userId?: string | null;
  workspaceId?: string | null;
  provider: ProviderName;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalCost?: number | null;
  createdAt: string;
}
