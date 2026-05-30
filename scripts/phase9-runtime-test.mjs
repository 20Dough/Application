// Phase 9 runtime test — exercises the Decision Summary System end-to-end
// against a running dev server (http://localhost:3000), plus direct Prisma
// seeding for the multi-user permission scenarios the single fixed dev user
// cannot reach alone.
//
// Covers: generating a decision summary from a room's recent messages through
// the AI Router, persisting it in the Decision model, listing decisions
// (workspace-wide and room-filtered), validation, and role-based permissions
// (viewers read-only, members may generate, non-members denied).
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/phase9-runtime-test.mjs
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
const TAG = `t9-${Date.now()}`;

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

async function main() {
  console.log(`\nPhase 9 runtime test against ${BASE}\n`);

  // --- Setup: a workspace (auto-seeds ARi + Cloudy) + a room with ARi -----
  console.log("Setup");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "decision summary runtime test",
  });
  check("create workspace → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  const room = (await api("POST", "/api/rooms", { workspaceId, name: "Planning" }))
    .json.room;
  check("create room → 201", Boolean(room?.id));

  const agents = (await api("GET", `/api/agents?workspaceId=${workspaceId}`)).json
    .agents;
  const ari = agents.find((a) => a.name === "ARi");
  check("workspace seeded ARi", Boolean(ari?.id));
  await api("POST", `/api/rooms/${room.id}/agents`, { agentId: ari.id });

  // ====================================================================
  // EMPTY LIST + VALIDATION
  // ====================================================================
  console.log("\nDecisions — empty list + validation");
  const empty = await api("GET", `/api/decisions?workspaceId=${workspaceId}`);
  check("GET decisions → 200", empty.status === 200, `got ${empty.status}`);
  check("starts empty", (empty.json?.decisions ?? []).length === 0);
  check("role reported as owner", empty.json?.role === "owner");

  check(
    "GET missing workspaceId → 400",
    (await api("GET", "/api/decisions")).status === 400
  );
  check(
    "POST missing workspaceId → 400",
    (await api("POST", "/api/summaries/decision", { roomId: room.id })).status === 400
  );
  check(
    "POST missing roomId → 400",
    (await api("POST", "/api/summaries/decision", { workspaceId })).status === 400
  );

  // Room with no messages yet cannot be summarized.
  const emptyRoom = (await api("POST", "/api/rooms", { workspaceId, name: "Idle" }))
    .json.room;
  const noMsgs = await api("POST", "/api/summaries/decision", {
    workspaceId,
    roomId: emptyRoom.id,
  });
  check("summarize empty room → 422", noMsgs.status === 422, `got ${noMsgs.status}`);

  // Room belonging to another workspace is rejected.
  const otherWs = await db.workspace.create({
    data: {
      name: `${TAG}-otherws`,
      ownerId: (await db.user.findUnique({ where: { email: DEV_EMAIL } })).id,
    },
  });
  const otherRoom = await db.room.create({
    data: { workspaceId: otherWs.id, name: "Foreign" },
  });
  const foreign = await api("POST", "/api/summaries/decision", {
    workspaceId,
    roomId: otherRoom.id,
  });
  check("room from another workspace → 400", foreign.status === 400, `got ${foreign.status}`);

  // ====================================================================
  // GENERATE + PERSIST + LIST
  // ====================================================================
  console.log("\nDecisions — generate, persist, list");
  // Seed a short conversation in the room.
  await api("POST", `/api/rooms/${room.id}/messages`, {
    content: "@ARi let's ship the MVP by Friday and use SQLite for now.",
  });
  await api("POST", `/api/rooms/${room.id}/messages`, {
    content: "Agreed. I'll own the API, you take the UI.",
  });

  const gen = await api("POST", "/api/summaries/decision", {
    workspaceId,
    roomId: room.id,
  });
  check("generate summary → 201", gen.status === 201, `got ${gen.status}`);
  const decision = gen.json?.decision;
  check("returns a decision id", Boolean(decision?.id));
  check("decision has a non-empty title", Boolean(decision?.title?.trim()));
  check("decision has a non-empty summary", Boolean(decision?.summary?.trim()));
  check("decision is scoped to the room", decision?.roomId === room.id);
  check("actionItems is an array", Array.isArray(decision?.actionItems));

  // Persisted in the Decision model.
  const persisted = await db.decision.findUnique({ where: { id: decision.id } });
  check("decision persisted in DB", Boolean(persisted));
  check("persisted workspaceId matches", persisted?.workspaceId === workspaceId);

  // Explicit agent selection.
  const genAgent = await api("POST", "/api/summaries/decision", {
    workspaceId,
    roomId: room.id,
    agentId: ari.id,
  });
  check("generate with explicit agent → 201", genAgent.status === 201, `got ${genAgent.status}`);

  const badAgent = await api("POST", "/api/summaries/decision", {
    workspaceId,
    roomId: room.id,
    agentId: "nonexistent-agent",
  });
  check("unknown agentId → 422", badAgent.status === 422, `got ${badAgent.status}`);

  // List now has the generated decisions, newest first.
  const list = await api("GET", `/api/decisions?workspaceId=${workspaceId}`);
  check("list now has decisions", (list.json?.decisions ?? []).length >= 2);
  check(
    "listed newest first",
    (() => {
      const ts = (list.json?.decisions ?? []).map((d) => new Date(d.createdAt).getTime());
      return ts.every((v, i) => i === 0 || ts[i - 1] >= v);
    })(),
    "createdAt not descending"
  );

  // Room filter includes this room's decisions (plus workspace-wide, of which
  // there are none here).
  const filtered = await api(
    "GET",
    `/api/decisions?workspaceId=${workspaceId}&roomId=${room.id}`
  );
  const filteredIds = (filtered.json?.decisions ?? []).map((d) => d.id);
  check("room filter includes the room's decision", filteredIds.includes(decision.id));

  // ====================================================================
  // PERMISSIONS
  // ====================================================================
  console.log("\nPermissions — member may generate, viewer read-only, non-member denied");
  const other = await db.user.create({
    data: { email: `owner-${TAG}@example.com`, name: "Other Owner" },
  });
  const devUser = await db.user.findUnique({ where: { email: DEV_EMAIL } });

  // Workspace where the dev user is a member: can read AND generate.
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
  const memberAgent = await db.agent.create({
    data: {
      workspaceId: memberWs.id,
      name: "ARi",
      displayName: "ARi",
      provider: "openai",
      model: "gpt-4o-mini",
      role: "Builder",
      systemPrompt: "You are ARi.",
    },
  });
  const memberRoom = await db.room.create({
    data: { workspaceId: memberWs.id, name: "Member room" },
  });
  await db.roomAgent.create({
    data: { roomId: memberRoom.id, agentId: memberAgent.id },
  });
  // Dev user (a member) posts a message, then generates a summary.
  const memberPost = await api("POST", `/api/rooms/${memberRoom.id}/messages`, {
    content: "We decided to launch next week.",
  });
  check("member can post a message → 201", memberPost.status === 201);
  const memberRead = await api("GET", `/api/decisions?workspaceId=${memberWs.id}`);
  check("member can read decisions → 200", memberRead.status === 200);
  const memberGen = await api("POST", "/api/summaries/decision", {
    workspaceId: memberWs.id,
    roomId: memberRoom.id,
  });
  check("member can generate a summary → 201", memberGen.status === 201, `got ${memberGen.status}`);

  // Workspace where the dev user is only a viewer: read yes, generate no.
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
    data: { workspaceId: viewerWs.id, name: "Viewer room" },
  });
  // Seed a message directly (the viewer cannot post one).
  await db.message.create({
    data: {
      roomId: viewerRoom.id,
      senderType: "human",
      userId: other.id,
      content: "Owner says: we go with plan A.",
    },
  });
  const viewerRead = await api("GET", `/api/decisions?workspaceId=${viewerWs.id}`);
  check("viewer can read decisions → 200", viewerRead.status === 200);
  check("viewer role reported", viewerRead.json?.role === "viewer");
  const viewerGen = await api("POST", "/api/summaries/decision", {
    workspaceId: viewerWs.id,
    roomId: viewerRoom.id,
  });
  check("viewer cannot generate a summary → 403", viewerGen.status === 403, `got ${viewerGen.status}`);

  // Workspace the dev user never joined → fully denied.
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
  check(
    "non-member cannot read decisions → 403",
    (await api("GET", `/api/decisions?workspaceId=${strangerWs.id}`)).status === 403
  );
  check(
    "non-member cannot generate a summary → 403",
    (await api("POST", "/api/summaries/decision", {
      workspaceId: strangerWs.id,
      roomId: strangerRoom.id,
    })).status === 403
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
