// Maps Prisma rows into the plain domain types used across the app.
//
// Two jobs: (1) convert Date → ISO string, (2) parse JSON-string columns
// (Message.metadata, Decision.actionItems) into real objects/arrays.

import type {
  Agent,
  Attachment,
  Decision,
  Invitation,
  MemoryItem,
  Message,
  MessageMetadata,
  ProjectContext,
  Room,
  RoomAgent,
  User,
  Workspace,
  WorkspaceMember,
} from "@/types";

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : d;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Inputs are typed loosely (Prisma rows use `string` for columns our domain
// types narrow to unions, e.g. provider/role/senderType). Casts happen here so
// call sites stay clean.

type RawUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  // May be present on the Prisma row — explicitly NOT forwarded to the client.
  passwordHash?: string | null;
  passwordSalt?: string | null;
};

export function serializeUser(u: RawUser): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: iso(u.createdAt),
    updatedAt: iso(u.updatedAt),
  };
}

type RawWorkspace = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeWorkspace(w: RawWorkspace): Workspace {
  return { ...w, createdAt: iso(w.createdAt), updatedAt: iso(w.updatedAt) };
}

export function serializeMember(m: {
  id: string;
  userId: string;
  workspaceId: string;
  role: string;
  createdAt: Date;
  user?: RawUser | null;
}): WorkspaceMember {
  return {
    id: m.id,
    userId: m.userId,
    workspaceId: m.workspaceId,
    role: m.role as WorkspaceMember["role"],
    createdAt: iso(m.createdAt),
    user: m.user ? serializeUser(m.user) : undefined,
  };
}

type RawRoom = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  defaultAgentId: string | null;
  createdById?: string | null;
  passcodeHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeRoom(r: RawRoom): Room {
  // Never leak the passcode hash to the client — only whether the room is locked.
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    name: r.name,
    description: r.description,
    defaultAgentId: r.defaultAgentId,
    createdById: r.createdById ?? null,
    isLocked: Boolean(r.passcodeHash),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

type RawAgent = {
  id: string;
  workspaceId: string;
  name: string;
  displayName: string;
  provider: string;
  model: string;
  role: string;
  systemPrompt: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeAgent(a: RawAgent): Agent {
  return {
    ...a,
    provider: a.provider as Agent["provider"],
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
  };
}

type RawMessage = {
  id: string;
  roomId: string;
  senderType: string;
  userId: string | null;
  agentId: string | null;
  content: string;
  metadata: string | null;
  createdAt: Date;
  user?: { name: string } | null;
  agent?: { displayName: string; role: string } | null;
};

export function serializeMessage(m: RawMessage): Message {
  return {
    id: m.id,
    roomId: m.roomId,
    senderType: m.senderType as Message["senderType"],
    userId: m.userId,
    agentId: m.agentId,
    content: m.content,
    metadata: parseJson<MessageMetadata | null>(m.metadata, null),
    createdAt: iso(m.createdAt),
    senderName: m.user?.name ?? m.agent?.displayName ?? undefined,
    agentRole: m.agent?.role,
  };
}

type RawMemory = {
  id: string;
  workspaceId: string;
  roomId: string | null;
  title: string;
  content: string;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeMemory(m: RawMemory): MemoryItem {
  return { ...m, createdAt: iso(m.createdAt), updatedAt: iso(m.updatedAt) };
}

type RawProjectContext = {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeProjectContext(c: RawProjectContext): ProjectContext {
  return { ...c, createdAt: iso(c.createdAt), updatedAt: iso(c.updatedAt) };
}

type RawDecision = {
  id: string;
  workspaceId: string;
  roomId: string | null;
  title: string;
  summary: string;
  actionItems: string | null;
  createdAt: Date;
};

export function serializeDecision(d: RawDecision): Decision {
  return {
    id: d.id,
    workspaceId: d.workspaceId,
    roomId: d.roomId,
    title: d.title,
    summary: d.summary,
    actionItems: parseJson<string[]>(d.actionItems, []),
    createdAt: iso(d.createdAt),
  };
}

type RawInvitation = {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
};

export function serializeInvitation(i: RawInvitation): Invitation {
  return {
    id: i.id,
    workspaceId: i.workspaceId,
    email: i.email,
    role: i.role as Invitation["role"],
    status: i.status as Invitation["status"],
    createdAt: iso(i.createdAt),
  };
}

type RawAttachment = {
  id: string;
  roomId: string;
  messageId: string | null;
  name: string;
  mimeType: string;
  size: number;
  extractedText?: string;
  createdAt: Date;
};

export function serializeAttachment(
  a: RawAttachment,
  includeText = false,
): Attachment {
  return {
    id: a.id,
    roomId: a.roomId,
    messageId: a.messageId,
    name: a.name,
    mimeType: a.mimeType,
    size: a.size,
    ...(includeText ? { extractedText: a.extractedText } : {}),
    createdAt: iso(a.createdAt),
  };
}

type RawRoomAgent = {
  id: string;
  roomId: string;
  agentId: string;
  createdAt: Date;
  agent?: RawAgent | null;
};

export function serializeRoomAgent(ra: RawRoomAgent): RoomAgent {
  return {
    id: ra.id,
    roomId: ra.roomId,
    agentId: ra.agentId,
    createdAt: iso(ra.createdAt),
    agent: ra.agent ? serializeAgent(ra.agent) : undefined,
  };
}
