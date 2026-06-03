// Thin client-side fetch helpers for the workspace UI.

import type {
  Agent,
  Attachment,
  Decision,
  Invitation,
  MemoryItem,
  Message,
  ProjectContext,
  Room,
  TokenInfo,
  User,
  Workspace,
  WorkspaceMember,
} from "@/types";
import type { SummaryRange } from "@/lib/summary/decision-summary";

export interface BootstrapData {
  currentUser: User;
  workspace: Workspace;
  members: WorkspaceMember[];
  rooms: Room[];
  agents: Agent[];
  projectContext: ProjectContext[];
  memory: MemoryItem[];
  decisions: Decision[];
  activeRoomId: string | null;
  messages: Message[];
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json.data as T;
}

export async function fetchBootstrap(): Promise<BootstrapData> {
  return unwrap<BootstrapData>(await fetch("/api/bootstrap"));
}

/** Header carrying a room passcode for locked rooms (omitted when none). */
function passcodeHeader(passcode?: string): Record<string, string> {
  return passcode ? { "x-room-passcode": passcode } : {};
}

export async function fetchMessages(
  roomId: string,
  passcode?: string,
): Promise<Message[]> {
  return unwrap<Message[]>(
    await fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`, {
      headers: passcodeHeader(passcode),
    }),
  );
}

export async function sendMessage(
  roomId: string,
  content: string,
  attachmentIds: string[] = [],
  passcode?: string,
): Promise<{ humanMessage: Message; agentMessages: Message[] }> {
  return unwrap(
    await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...passcodeHeader(passcode),
      },
      body: JSON.stringify({ roomId, content, attachmentIds }),
    }),
  );
}

export async function uploadFile(
  roomId: string,
  file: File,
  passcode?: string,
): Promise<Attachment> {
  const form = new FormData();
  form.append("roomId", roomId);
  form.append("file", file);
  return unwrap<Attachment>(
    await fetch("/api/files", {
      method: "POST",
      headers: passcodeHeader(passcode),
      body: form,
    }),
  );
}

export async function fetchAttachments(
  roomId: string,
  passcode?: string,
): Promise<Attachment[]> {
  return unwrap<Attachment[]>(
    await fetch(`/api/files?roomId=${encodeURIComponent(roomId)}`, {
      headers: passcodeHeader(passcode),
    }),
  );
}

export async function fetchTokens(workspaceId: string): Promise<TokenInfo> {
  return unwrap<TokenInfo>(
    await fetch(`/api/tokens?workspaceId=${encodeURIComponent(workspaceId)}`),
  );
}

export async function verifyRoomPasscode(
  roomId: string,
  passcode: string,
): Promise<{ unlocked: boolean }> {
  return postJson(`/api/rooms/${encodeURIComponent(roomId)}/verify`, {
    passcode,
  });
}

export async function setRoomPasscode(
  roomId: string,
  passcode: string | null,
): Promise<Room> {
  return unwrap<Room>(
    await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    }),
  );
}

export async function updateAgent(
  agentId: string,
  patch: Partial<
    Pick<
      Agent,
      | "displayName"
      | "provider"
      | "model"
      | "role"
      | "systemPrompt"
      | "isActive"
    >
  >,
): Promise<Agent> {
  return unwrap<Agent>(
    await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function createRoom(
  workspaceId: string,
  name: string,
): Promise<Room> {
  return unwrap<Room>(
    await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name }),
    }),
  );
}

export async function generateSummary(
  roomId: string,
  range: SummaryRange = "recent30",
  passcode?: string,
): Promise<Decision> {
  return unwrap<Decision>(
    await fetch("/api/summaries/decision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...passcodeHeader(passcode),
      },
      body: JSON.stringify({ roomId, range }),
    }),
  );
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => unwrap<T>(r));
}

export async function addMemory(
  workspaceId: string,
  title: string,
  content: string,
  importance = 1,
): Promise<MemoryItem> {
  return postJson<MemoryItem>("/api/memory", {
    workspaceId,
    title,
    content,
    importance,
  });
}

export async function addProjectContext(
  workspaceId: string,
  title: string,
  content: string,
): Promise<ProjectContext> {
  return postJson<ProjectContext>("/api/project-context", {
    workspaceId,
    title,
    content,
  });
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: string,
): Promise<Invitation> {
  return postJson<Invitation>("/api/invitations", { workspaceId, email, role });
}
