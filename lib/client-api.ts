// Thin client-side fetch helpers for the workspace UI.

import type {
  Agent,
  Decision,
  Invitation,
  MemoryItem,
  Message,
  ProjectContext,
  Room,
  User,
  Workspace,
  WorkspaceMember,
} from "@/types";

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

// --- Auth ---

export async function fetchMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me");
  if (res.status === 401) return null;
  return unwrap<User>(res);
}

export async function login(username: string, password: string): Promise<User> {
  return unwrap<User>(
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  );
}

export async function register(
  username: string,
  password: string,
  name: string,
): Promise<User> {
  return unwrap<User>(
    await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, name }),
    }),
  );
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function fetchBootstrap(): Promise<BootstrapData> {
  return unwrap<BootstrapData>(await fetch("/api/bootstrap"));
}

export async function fetchMessages(roomId: string): Promise<Message[]> {
  return unwrap<Message[]>(
    await fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`),
  );
}

export async function sendMessage(
  roomId: string,
  content: string,
): Promise<{ humanMessage: Message; agentMessages: Message[] }> {
  return unwrap(
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, content }),
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

export async function generateSummary(roomId: string): Promise<Decision> {
  return unwrap<Decision>(
    await fetch("/api/summaries/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
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
