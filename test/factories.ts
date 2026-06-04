import { db } from "@/lib/db";
import { hashSecret } from "@/lib/crypto";
import { hashPasscode } from "@/lib/rooms/passcode";
import { createSession } from "@/lib/auth/session";
import type { WorkspaceRole } from "@/types";

let counter = 0;
const uniq = () => `${Date.now()}_${counter++}`;

export async function createUser(
  overrides: { email?: string; name?: string; password?: string } = {},
) {
  const { hash, salt } = hashSecret(overrides.password ?? "password");
  return db.user.create({
    data: {
      email: overrides.email ?? `user_${uniq()}@test.dev`,
      name: overrides.name ?? "Test User",
      passwordHash: hash,
      passwordSalt: salt,
    },
  });
}

/** Populate the mocked cookie store with a valid session for the user. */
export async function loginAs(userId: string) {
  await createSession(userId);
}

interface WorkspaceFixture {
  ownerRole?: WorkspaceRole;
  passcode?: string;
}

/**
 * Create a user + workspace (they own) + two active agents (ARi/Cloudy) + a room
 * with both agents, ARi as default. Returns the key ids for assertions.
 */
export async function createWorkspaceFixture(opts: WorkspaceFixture = {}) {
  const owner = await createUser();
  const workspace = await db.workspace.create({
    data: {
      name: "Test WS",
      ownerId: owner.id,
      members: {
        create: { userId: owner.id, role: opts.ownerRole ?? "owner" },
      },
    },
  });

  const ari = await db.agent.create({
    data: {
      workspaceId: workspace.id,
      name: "ari",
      displayName: "ARi",
      provider: "openai",
      model: "gpt-4o",
      role: "Reviewer",
      systemPrompt: "You are ARi.",
    },
  });
  const cloudy = await db.agent.create({
    data: {
      workspaceId: workspace.id,
      name: "cloudy",
      displayName: "Cloudy",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      role: "Architect",
      systemPrompt: "You are Cloudy.",
    },
  });

  const passcode = opts.passcode
    ? hashPasscode(opts.passcode)
    : { hash: null, salt: null };

  const room = await db.room.create({
    data: {
      workspaceId: workspace.id,
      name: "General",
      defaultAgentId: ari.id,
      createdById: owner.id,
      passcodeHash: passcode.hash,
      passcodeSalt: passcode.salt,
      roomAgents: { create: [{ agentId: ari.id }, { agentId: cloudy.id }] },
    },
  });

  return { owner, workspace, ari, cloudy, room };
}

/** Add an existing/extra member to a workspace with a given role. */
export async function addMember(
  workspaceId: string,
  role: WorkspaceRole,
  email?: string,
) {
  const user = await createUser(email ? { email } : {});
  await db.workspaceMember.create({
    data: { userId: user.id, workspaceId, role },
  });
  return user;
}

/** Build a Request with optional JSON body and headers. */
export function jsonRequest(
  url: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers: Record<string, string> = { ...init.headers };
  let body: string | undefined;
  if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  return new Request(url, { method: init.method ?? "GET", headers, body });
}

/** Read the JSON envelope ({ data } | { error }) and status from a Response. */
export async function readJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}
