// Phase 6 runtime test — exercises the Human Chat System end-to-end against a
// running dev server (http://localhost:3000) plus direct Prisma seeding for the
// permission scenarios the single fixed dev user cannot reach alone.
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/phase6-runtime-test.mjs
// (the dev server must be running; the script also talks to the DB directly for
// the multi-user permission scenarios).

import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new PrismaClient();

let passed = 0;
let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

const DEV_EMAIL = "dev@hivemind.local";
const TAG = `t6-${Date.now()}`;

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

async function main() {
  console.log(`\nPhase 6 runtime test against ${BASE}\n`);

  // --- Setup: a workspace + room (workspace auto-seeds ARi + Cloudy) ---
  console.log("Setup");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "chat runtime test",
  });
  check("POST /api/workspaces → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  const agentList = await api("GET", `/api/agents?workspaceId=${workspaceId}`);
  const ari = agentList.json.agents.find((a) => a.name === "ARi");
  check("workspace seeded ARi", Boolean(ari));

  const createRoom = await api("POST", "/api/rooms", {
    workspaceId,
    name: "General",
    description: "Team chat",
  });
  check("create room → 201", createRoom.status === 201, `got ${createRoom.status}`);
  const roomId = createRoom.json?.room?.id;
  check("room has id", Boolean(roomId));

  // --- Empty room: no messages yet ------------------------------------
  console.log("\nEmpty room");
  const empty = await api("GET", `/api/rooms/${roomId}/messages`);
  check("GET messages → 200", empty.status === 200, `got ${empty.status}`);
  check("starts with no messages", (empty.json?.messages ?? []).length === 0);
  check("role reported as owner", empty.json?.role === "owner");
  check("currentUserId present", Boolean(empty.json?.currentUserId));

  // --- Send human messages + validation -------------------------------
  console.log("\nSend messages + validation");
  const blank = await api("POST", `/api/rooms/${roomId}/messages`, { content: "   " });
  check("empty content → 400", blank.status === 400, `got ${blank.status}`);

  const tooLong = await api("POST", `/api/rooms/${roomId}/messages`, {
    content: "x".repeat(4001),
  });
  check("over-length content → 400", tooLong.status === 400, `got ${tooLong.status}`);

  const sent = await api("POST", `/api/rooms/${roomId}/messages`, {
    content: "Hello team",
  });
  check("send message → 201", sent.status === 201, `got ${sent.status}`);
  check("senderType is human", sent.json?.message?.senderType === "human");
  check("content trimmed/stored", sent.json?.message?.content === "Hello team");
  check("authored by current user", Boolean(sent.json?.message?.user?.id));
  check("agent author is null", sent.json?.message?.agent === null);
  check("has a timestamp", Boolean(sent.json?.message?.createdAt));

  const sent2 = await api("POST", `/api/rooms/${roomId}/messages`, {
    content: "  Second message  ",
  });
  check("second send → 201", sent2.status === 201, `got ${sent2.status}`);
  check("leading/trailing whitespace trimmed", sent2.json?.message?.content === "Second message");

  // --- Messages persist + ordering ------------------------------------
  console.log("\nPersistence + ordering");
  const after = await api("GET", `/api/rooms/${roomId}/messages`);
  check("two messages persisted", (after.json?.messages ?? []).length === 2);
  check(
    "ordered oldest → newest",
    after.json.messages[0]?.content === "Hello team" &&
      after.json.messages[1]?.content === "Second message"
  );
  const inDb = await db.message.count({ where: { roomId } });
  check("messages persisted in DB", inDb === 2, `db count ${inDb}`);

  // --- Messages are scoped to their room ------------------------------
  console.log("\nRoom scoping");
  const otherRoom = await api("POST", "/api/rooms", {
    workspaceId,
    name: "Other",
  });
  const otherRoomId = otherRoom.json?.room?.id;
  const otherMessages = await api("GET", `/api/rooms/${otherRoomId}/messages`);
  check("new room has no messages", (otherMessages.json?.messages ?? []).length === 0);

  // --- Unknown room ----------------------------------------------------
  console.log("\nNot found");
  const ghostGet = await api("GET", `/api/rooms/does-not-exist/messages`);
  check("messages for unknown room → 404", ghostGet.status === 404, `got ${ghostGet.status}`);
  const ghostPost = await api("POST", `/api/rooms/does-not-exist/messages`, {
    content: "hi",
  });
  check("post to unknown room → 404", ghostPost.status === 404, `got ${ghostPost.status}`);

  // --- System message rendering support (schema-level) ----------------
  console.log("\nSystem message support");
  const sys = await db.message.create({
    data: { roomId, senderType: "system", content: "Room created." },
  });
  const withSys = await api("GET", `/api/rooms/${roomId}/messages`);
  const sysMsg = (withSys.json?.messages ?? []).find((m) => m.id === sys.id);
  check("system message returned", Boolean(sysMsg));
  check("system message has no user/agent", sysMsg?.user === null && sysMsg?.agent === null);

  // --- Permissions: viewer is read-only, non-member denied ------------
  console.log("\nPermissions");
  const other = await db.user.create({
    data: { email: `owner-${TAG}@example.com`, name: "Other Owner" },
  });
  const devUser = await db.user.findUnique({ where: { email: DEV_EMAIL } });

  // Workspace where the dev user is only a viewer.
  const viewerWs = await db.workspace.create({
    data: {
      name: `${TAG}-viewer`,
      ownerId: other.id,
      members: {
        create: [
          { userId: other.id, role: "owner" },
          { userId: devUser.id, role: "viewer" },
        ],
      },
    },
  });
  const viewerRoom = await db.room.create({
    data: { workspaceId: viewerWs.id, name: "Viewer Room" },
  });

  const viewerRead = await api("GET", `/api/rooms/${viewerRoom.id}/messages`);
  check("viewer can read messages → 200", viewerRead.status === 200, `got ${viewerRead.status}`);
  check("viewer role reported", viewerRead.json?.role === "viewer");

  const viewerSend = await api("POST", `/api/rooms/${viewerRoom.id}/messages`, {
    content: "I am a viewer",
  });
  check("viewer cannot send → 403", viewerSend.status === 403, `got ${viewerSend.status}`);

  // Workspace the dev user never joined.
  const strangerWs = await db.workspace.create({
    data: {
      name: `${TAG}-stranger`,
      ownerId: other.id,
      members: { create: { userId: other.id, role: "owner" } },
    },
  });
  const strangerRoom = await db.room.create({
    data: { workspaceId: strangerWs.id, name: "Private" },
  });
  const deniedRead = await api("GET", `/api/rooms/${strangerRoom.id}/messages`);
  check("non-member cannot read → 403", deniedRead.status === 403, `got ${deniedRead.status}`);
  const deniedSend = await api("POST", `/api/rooms/${strangerRoom.id}/messages`, {
    content: "let me in",
  });
  check("non-member cannot send → 403", deniedSend.status === 403, `got ${deniedSend.status}`);
}

main()
  .catch((err) => {
    console.error("\nFATAL:", err);
    failed++;
  })
  .finally(async () => {
    await cleanup();
    await db.$disconnect();
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed === 0 ? 0 : 1);
  });
