// Phase 8 runtime test — exercises Project Context + Shared Memory management
// end-to-end against a running dev server (http://localhost:3000), plus direct
// Prisma seeding for the permission scenarios the single fixed dev user cannot
// reach alone. Also confirms the curated context still flows into the AI Router
// (the collaboration loop keeps working with context/memory present).
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/phase8-runtime-test.mjs
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
const TAG = `t8-${Date.now()}`;

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

async function main() {
  console.log(`\nPhase 8 runtime test against ${BASE}\n`);

  // --- Setup: a workspace (auto-seeds ARi + Cloudy) + a room ------------
  console.log("Setup");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "memory & context runtime test",
  });
  check("create workspace → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  const room = (await api("POST", "/api/rooms", { workspaceId, name: "General" }))
    .json.room;
  check("create room → 201", Boolean(room?.id));

  // ====================================================================
  // PROJECT CONTEXT
  // ====================================================================
  console.log("\nProject context — empty + validation");
  const pcEmpty = await api("GET", `/api/project-context?workspaceId=${workspaceId}`);
  check("GET project-context → 200", pcEmpty.status === 200, `got ${pcEmpty.status}`);
  check("starts empty", (pcEmpty.json?.projectContexts ?? []).length === 0);
  check("role reported as owner", pcEmpty.json?.role === "owner");

  check(
    "missing workspaceId → 400",
    (await api("GET", "/api/project-context")).status === 400
  );
  check(
    "blank title → 400",
    (await api("POST", "/api/project-context", {
      workspaceId,
      title: "   ",
      content: "x",
    })).status === 400
  );
  check(
    "blank content → 400",
    (await api("POST", "/api/project-context", {
      workspaceId,
      title: "Mission",
      content: "  ",
    })).status === 400
  );

  console.log("\nProject context — create / list / update / delete");
  const pcCreate = await api("POST", "/api/project-context", {
    workspaceId,
    title: "Mission",
    content: "Ship the HiveMind MVP.",
  });
  check("create → 201", pcCreate.status === 201, `got ${pcCreate.status}`);
  const pcId = pcCreate.json?.projectContext?.id;
  check("returns created entry", Boolean(pcId));
  check("content stored", pcCreate.json?.projectContext?.content === "Ship the HiveMind MVP.");

  const pcList = await api("GET", `/api/project-context?workspaceId=${workspaceId}`);
  check("list now has one entry", (pcList.json?.projectContexts ?? []).length === 1);

  const pcPatch = await api("PATCH", `/api/project-context/${pcId}`, {
    content: "Ship the HiveMind MVP this quarter.",
  });
  check("update → 200", pcPatch.status === 200, `got ${pcPatch.status}`);
  check(
    "update persisted",
    pcPatch.json?.projectContext?.content === "Ship the HiveMind MVP this quarter."
  );
  check(
    "title untouched on partial update",
    pcPatch.json?.projectContext?.title === "Mission"
  );

  check(
    "patch unknown id → 404",
    (await api("PATCH", "/api/project-context/nope", { title: "x" })).status === 404
  );
  check(
    "empty patch → 400",
    (await api("PATCH", `/api/project-context/${pcId}`, {})).status === 400
  );

  // ====================================================================
  // SHARED MEMORY
  // ====================================================================
  console.log("\nMemory — empty + validation");
  const memEmpty = await api("GET", `/api/memory?workspaceId=${workspaceId}`);
  check("GET memory → 200", memEmpty.status === 200, `got ${memEmpty.status}`);
  check("starts empty", (memEmpty.json?.memoryItems ?? []).length === 0);

  check(
    "blank title → 400",
    (await api("POST", "/api/memory", { workspaceId, title: "", content: "x" })).status === 400
  );
  check(
    "blank content → 400",
    (await api("POST", "/api/memory", { workspaceId, title: "x", content: "" })).status === 400
  );

  console.log("\nMemory — create / importance clamp / room scope");
  const memCreate = await api("POST", "/api/memory", {
    workspaceId,
    title: "Brand voice",
    content: "Warm, concise, no hype.",
    importance: 4,
  });
  check("create → 201", memCreate.status === 201, `got ${memCreate.status}`);
  const memId = memCreate.json?.memoryItem?.id;
  check("returns created item", Boolean(memId));
  check("importance stored", memCreate.json?.memoryItem?.importance === 4);
  check("defaults to workspace-wide (roomId null)", memCreate.json?.memoryItem?.roomId === null);

  const memClamp = await api("POST", "/api/memory", {
    workspaceId,
    title: "Over the top",
    content: "Should clamp to max.",
    importance: 99,
  });
  check("importance clamped to max (5)", memClamp.json?.memoryItem?.importance === 5);

  const memDefault = await api("POST", "/api/memory", {
    workspaceId,
    title: "No importance given",
    content: "Falls back to default.",
  });
  check("importance defaults when omitted", memDefault.json?.memoryItem?.importance === 1);

  // Room-scoped memory + cross-workspace room rejection.
  const memScoped = await api("POST", "/api/memory", {
    workspaceId,
    title: "Room note",
    content: "Specific to General.",
    roomId: room.id,
  });
  check("room-scoped create → 201", memScoped.status === 201, `got ${memScoped.status}`);
  check("roomId persisted", memScoped.json?.memoryItem?.roomId === room.id);

  const otherWs = await db.workspace.create({
    data: {
      name: `${TAG}-otherws`,
      ownerId: (await db.user.findUnique({ where: { email: DEV_EMAIL } })).id,
    },
  });
  const otherRoom = await db.room.create({
    data: { workspaceId: otherWs.id, name: "Foreign room" },
  });
  const memForeign = await api("POST", "/api/memory", {
    workspaceId,
    title: "Bad scope",
    content: "Room from another workspace.",
    roomId: otherRoom.id,
  });
  check(
    "room from another workspace → 400",
    memForeign.status === 400,
    `got ${memForeign.status}`
  );

  console.log("\nMemory — ordering, update, delete");
  const memList = await api("GET", `/api/memory?workspaceId=${workspaceId}`);
  const importances = (memList.json?.memoryItems ?? []).map((m) => m.importance);
  check(
    "listed most-important first",
    importances.every((v, i) => i === 0 || importances[i - 1] >= v),
    `order: ${importances.join(",")}`
  );

  const memScopedFilter = await api(
    "GET",
    `/api/memory?workspaceId=${workspaceId}&roomId=${room.id}`
  );
  const scopedIds = (memScopedFilter.json?.memoryItems ?? []).map((m) => m.id);
  check("room filter includes the room-scoped item", scopedIds.includes(memScoped.json.memoryItem.id));
  check("room filter still includes workspace-wide items", scopedIds.includes(memId));

  const memPatch = await api("PATCH", `/api/memory/${memId}`, { importance: 2 });
  check("update importance → 200", memPatch.status === 200, `got ${memPatch.status}`);
  check("importance updated", memPatch.json?.memoryItem?.importance === 2);

  const memClear = await api("PATCH", `/api/memory/${memScoped.json.memoryItem.id}`, {
    roomId: "",
  });
  check("clearing roomId makes it workspace-wide", memClear.json?.memoryItem?.roomId === null);

  const memDelete = await api("DELETE", `/api/memory/${memId}`);
  check("delete → 200", memDelete.status === 200, `got ${memDelete.status}`);
  check(
    "deleted item is gone",
    (await api("GET", `/api/memory/${memId}`)).status === 404
  );

  // ====================================================================
  // INTEGRATION: context + memory reach the AI Router
  // ====================================================================
  console.log("\nIntegration — collaboration loop still works with context present");
  const agents = (await api("GET", `/api/agents?workspaceId=${workspaceId}`)).json.agents;
  const ari = agents.find((a) => a.name === "ARi");
  await api("POST", `/api/rooms/${room.id}/agents`, { agentId: ari.id });
  const loop = await api("POST", `/api/rooms/${room.id}/messages`, {
    content: "@ARi what's our mission?",
  });
  check("message send still → 201", loop.status === 201, `got ${loop.status}`);
  const agentReply = (loop.json?.replies ?? []).find((m) => m.senderType === "agent");
  check("ARi still responds with curated context loaded", Boolean(agentReply));

  // The shared sources the router builds context from are queryable directly:
  const ctxCount = await db.projectContext.count({ where: { workspaceId } });
  const memCount = await db.memoryItem.count({ where: { workspaceId } });
  check("project context persisted for context building", ctxCount >= 1, `count ${ctxCount}`);
  check("memory persisted for context building", memCount >= 1, `count ${memCount}`);

  // ====================================================================
  // PERMISSIONS
  // ====================================================================
  console.log("\nPermissions — viewer read-only, member read-only, non-member denied");
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
  await db.projectContext.create({
    data: { workspaceId: viewerWs.id, title: "Seed", content: "Visible to viewer." },
  });

  const viewerReadPc = await api("GET", `/api/project-context?workspaceId=${viewerWs.id}`);
  check("viewer can read project context → 200", viewerReadPc.status === 200);
  check("viewer role reported", viewerReadPc.json?.role === "viewer");
  const viewerWritePc = await api("POST", "/api/project-context", {
    workspaceId: viewerWs.id,
    title: "x",
    content: "y",
  });
  check("viewer cannot create project context → 403", viewerWritePc.status === 403, `got ${viewerWritePc.status}`);
  const viewerWriteMem = await api("POST", "/api/memory", {
    workspaceId: viewerWs.id,
    title: "x",
    content: "y",
  });
  check("viewer cannot create memory → 403", viewerWriteMem.status === 403, `got ${viewerWriteMem.status}`);

  // Workspace where the dev user is a member (not owner/admin): read yes, write no.
  const memberWs = await db.workspace.create({
    data: {
      name: `${TAG}-member`,
      ownerId: other.id,
      members: {
        create: [
          { userId: other.id, role: "owner" },
          { userId: devUser.id, role: "member" },
        ],
      },
    },
  });
  const memberReadMem = await api("GET", `/api/memory?workspaceId=${memberWs.id}`);
  check("member can read memory → 200", memberReadMem.status === 200);
  const memberWriteMem = await api("POST", "/api/memory", {
    workspaceId: memberWs.id,
    title: "x",
    content: "y",
  });
  check("member cannot create memory → 403", memberWriteMem.status === 403, `got ${memberWriteMem.status}`);

  // Workspace the dev user never joined → fully denied.
  const strangerWs = await db.workspace.create({
    data: {
      name: `${TAG}-stranger`,
      ownerId: other.id,
      members: { create: { userId: other.id, role: "owner" } },
    },
  });
  const strangerPc = await db.projectContext.create({
    data: { workspaceId: strangerWs.id, title: "Private", content: "Hidden." },
  });
  check(
    "non-member cannot read project context → 403",
    (await api("GET", `/api/project-context?workspaceId=${strangerWs.id}`)).status === 403
  );
  check(
    "non-member cannot read memory → 403",
    (await api("GET", `/api/memory?workspaceId=${strangerWs.id}`)).status === 403
  );
  check(
    "non-member cannot patch a foreign entry → 403",
    (await api("PATCH", `/api/project-context/${strangerPc.id}`, { title: "x" })).status === 403
  );

  console.log("\nProject context — delete (cleanup of owned entry)");
  const pcDelete = await api("DELETE", `/api/project-context/${pcId}`);
  check("delete → 200", pcDelete.status === 200, `got ${pcDelete.status}`);
  check(
    "deleted entry is gone",
    (await api("GET", `/api/project-context/${pcId}`)).status === 404
  );
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
