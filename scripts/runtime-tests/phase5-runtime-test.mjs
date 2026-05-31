// Phase 5 runtime test — exercises Room Management end-to-end against a running
// dev server (http://localhost:3000) plus direct Prisma seeding for the
// permission scenarios the single fixed dev user cannot reach alone.
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/runtime-tests/phase5-runtime-test.mjs
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
const TAG = `t5-${Date.now()}`;

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

async function main() {
  console.log(`\nPhase 5 runtime test against ${BASE}\n`);

  // --- Setup: a workspace (auto-seeds ARi + Cloudy) --------------------
  console.log("Setup");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "room runtime test",
  });
  check("POST /api/workspaces → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  const agentList = await api("GET", `/api/agents?workspaceId=${workspaceId}`);
  const ari = agentList.json.agents.find((a) => a.name === "ARi");
  const cloudy = agentList.json.agents.find((a) => a.name === "Cloudy");
  check("workspace seeded ARi + Cloudy", Boolean(ari && cloudy));

  // --- Room creation + validation --------------------------------------
  console.log("\nRoom creation + validation");
  const missingWs = await api("POST", "/api/rooms", { name: "x" });
  check("missing workspaceId → 400", missingWs.status === 400, `got ${missingWs.status}`);

  const emptyName = await api("POST", "/api/rooms", { workspaceId, name: "   " });
  check("empty name → 400", emptyName.status === 400, `got ${emptyName.status}`);

  const createRoom = await api("POST", "/api/rooms", {
    workspaceId,
    name: "Planning",
    description: "Sprint planning",
  });
  check("valid create → 201", createRoom.status === 201, `got ${createRoom.status}`);
  const roomId = createRoom.json?.room?.id;
  check("room has id", Boolean(roomId));
  check("description stored", createRoom.json?.room?.description === "Sprint planning");

  // --- Room list -------------------------------------------------------
  console.log("\nRoom list");
  const list = await api("GET", `/api/rooms?workspaceId=${workspaceId}`);
  check("GET /api/rooms → 200", list.status === 200, `got ${list.status}`);
  const listed = (list.json?.rooms ?? []).find((r) => r.id === roomId);
  check("created room is listed", Boolean(listed));
  check("agentCount starts at 0", listed?.agentCount === 0, String(listed?.agentCount));
  check("role reported as owner", list.json?.role === "owner");

  // --- Room detail: humans + agents ------------------------------------
  console.log("\nRoom detail");
  const detail1 = await api("GET", `/api/rooms/${roomId}`);
  check("GET /api/rooms/[id] → 200", detail1.status === 200, `got ${detail1.status}`);
  check("humans = workspace members (1 dev user)", detail1.json?.members?.length === 1);
  check("room has no agents yet", detail1.json?.agents?.length === 0);
  check(
    "both workspace agents available to add",
    detail1.json?.availableAgents?.length === 2,
    String(detail1.json?.availableAgents?.length)
  );

  // --- Add AI agents ---------------------------------------------------
  console.log("\nAdd AI agents");
  const addAri = await api("POST", `/api/rooms/${roomId}/agents`, { agentId: ari.id });
  check("add ARi → 201", addAri.status === 201, `got ${addAri.status}`);

  const addDupe = await api("POST", `/api/rooms/${roomId}/agents`, { agentId: ari.id });
  check("add ARi again → 409", addDupe.status === 409, `got ${addDupe.status}`);

  const addStranger = await api("POST", `/api/rooms/${roomId}/agents`, {
    agentId: "does-not-exist",
  });
  check("add unknown agent → 404", addStranger.status === 404, `got ${addStranger.status}`);

  const detail2 = await api("GET", `/api/rooms/${roomId}`);
  check("room now has 1 agent", detail2.json?.agents?.length === 1);
  check("available agents now 1", detail2.json?.availableAgents?.length === 1);

  // --- Set default room agent ------------------------------------------
  console.log("\nSet default agent");
  const setDefaultStranger = await api("PATCH", `/api/rooms/${roomId}`, {
    defaultAgentId: cloudy.id, // Cloudy is not in the room yet
  });
  check("default must be in room → 400", setDefaultStranger.status === 400, `got ${setDefaultStranger.status}`);

  const setDefault = await api("PATCH", `/api/rooms/${roomId}`, {
    defaultAgentId: ari.id,
  });
  check("set default to ARi → 200", setDefault.status === 200, `got ${setDefault.status}`);
  check("defaultAgentId persisted", setDefault.json?.room?.defaultAgentId === ari.id);

  const listWithDefault = await api("GET", `/api/rooms?workspaceId=${workspaceId}`);
  const roomWithDefault = listWithDefault.json.rooms.find((r) => r.id === roomId);
  check("list surfaces default agent", roomWithDefault?.defaultAgent?.id === ari.id);

  const clearDefault = await api("PATCH", `/api/rooms/${roomId}`, {
    defaultAgentId: null,
  });
  check("clear default → 200", clearDefault.status === 200);
  check("default now null", clearDefault.json?.room?.defaultAgentId === null);

  // --- Removing the default agent clears the default -------------------
  console.log("\nRemove agent (clears default)");
  await api("PATCH", `/api/rooms/${roomId}`, { defaultAgentId: ari.id });
  const removeAri = await api("DELETE", `/api/rooms/${roomId}/agents/${ari.id}`);
  check("remove ARi → 200", removeAri.status === 200, `got ${removeAri.status}`);
  const afterRemove = await db.room.findUnique({ where: { id: roomId } });
  check("default cleared after removing default agent", afterRemove?.defaultAgentId === null);
  const detail3 = await api("GET", `/api/rooms/${roomId}`);
  check("room has no agents after removal", detail3.json?.agents?.length === 0);

  const removeAgain = await api("DELETE", `/api/rooms/${roomId}/agents/${ari.id}`);
  check("remove agent not in room → 404", removeAgain.status === 404, `got ${removeAgain.status}`);

  // --- Update room name/description ------------------------------------
  console.log("\nUpdate room");
  const rename = await api("PATCH", `/api/rooms/${roomId}`, { name: "Renamed Room" });
  check("rename → 200", rename.status === 200, `got ${rename.status}`);
  check("name updated", rename.json?.room?.name === "Renamed Room");

  const emptyUpdate = await api("PATCH", `/api/rooms/${roomId}`, {});
  check("empty update → 400", emptyUpdate.status === 400, `got ${emptyUpdate.status}`);

  // --- Not found -------------------------------------------------------
  console.log("\nNot found");
  const ghost = await api("GET", `/api/rooms/does-not-exist`);
  check("unknown room → 404", ghost.status === 404, `got ${ghost.status}`);

  // --- Permissions: viewer cannot manage, non-member denied ------------
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

  const viewerList = await api("GET", `/api/rooms?workspaceId=${viewerWs.id}`);
  check("viewer can list rooms → 200", viewerList.status === 200, `got ${viewerList.status}`);
  check("viewer role reported", viewerList.json?.role === "viewer");

  const viewerCreate = await api("POST", "/api/rooms", {
    workspaceId: viewerWs.id,
    name: "Sneaky",
  });
  check("viewer cannot create room → 403", viewerCreate.status === 403, `got ${viewerCreate.status}`);

  const viewerDelete = await api("DELETE", `/api/rooms/${viewerRoom.id}`);
  check("viewer cannot delete room → 403", viewerDelete.status === 403, `got ${viewerDelete.status}`);

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
  const denied = await api("GET", `/api/rooms/${strangerRoom.id}`);
  check("non-member room detail → 403", denied.status === 403, `got ${denied.status}`);

  // --- Delete room -----------------------------------------------------
  console.log("\nDelete room");
  const del = await api("DELETE", `/api/rooms/${roomId}`);
  check("DELETE → 200", del.status === 200, `got ${del.status}`);
  const gone = await db.room.findUnique({ where: { id: roomId } });
  check("room removed from DB", gone === null);
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
