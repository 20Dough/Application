// Phase 12 runtime test — exercises the Multi-Agent Discussion system
// end-to-end against a running dev server (http://localhost:3000), plus direct
// Prisma seeding for the multi-user permission scenarios the single fixed dev
// user cannot reach alone.
//
// Covers: running a multi-agent discussion through the orchestrator (rounds ×
// participants turns, reusing the provider factory + Context Builder + RAG),
// synthesis (summary / consensus / disagreements), persistence, listing
// (workspace-wide + room-filtered), detail fetch, generating a Decision from a
// discussion (and linking it back), validation, rounds clamping, the
// two-agent minimum, and role-based permissions (viewer read-only, member may
// run, non-member denied).
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/phase12-runtime-test.mjs
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
const TAG = `t12-${Date.now()}`;

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

async function main() {
  console.log(`\nPhase 12 runtime test against ${BASE}\n`);

  // --- Setup: a workspace (auto-seeds ARi + Cloudy) + a room with both -----
  console.log("Setup");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "multi-agent discussion runtime test",
  });
  check("create workspace → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  const room = (await api("POST", "/api/rooms", { workspaceId, name: "Design" }))
    .json.room;
  check("create room → 201", Boolean(room?.id));

  const agents = (await api("GET", `/api/agents?workspaceId=${workspaceId}`)).json
    .agents;
  const ari = agents.find((a) => a.name === "ARi");
  const cloudy = agents.find((a) => a.name === "Cloudy");
  check("workspace seeded ARi + Cloudy", Boolean(ari?.id) && Boolean(cloudy?.id));
  await api("POST", `/api/rooms/${room.id}/agents`, { agentId: ari.id });
  await api("POST", `/api/rooms/${room.id}/agents`, { agentId: cloudy.id });

  // ====================================================================
  // VALIDATION + TWO-AGENT MINIMUM
  // ====================================================================
  console.log("\nDiscussions — validation + minimum participants");
  const emptyList = await api("GET", `/api/discussions?workspaceId=${workspaceId}`);
  check("GET discussions → 200", emptyList.status === 200, `got ${emptyList.status}`);
  check("starts empty", (emptyList.json?.discussions ?? []).length === 0);
  check("role reported as owner", emptyList.json?.role === "owner");

  check(
    "GET missing workspaceId → 400",
    (await api("GET", "/api/discussions")).status === 400
  );
  check(
    "POST missing workspaceId → 400",
    (await api("POST", "/api/discussions", { roomId: room.id, topic: "x" })).status === 400
  );
  check(
    "POST missing roomId → 400",
    (await api("POST", "/api/discussions", { workspaceId, topic: "x" })).status === 400
  );
  check(
    "POST missing topic → 400",
    (await api("POST", "/api/discussions", { workspaceId, roomId: room.id })).status === 400
  );

  // Room with a single agent cannot host an agent-to-agent discussion.
  const soloRoom = (await api("POST", "/api/rooms", { workspaceId, name: "Solo" }))
    .json.room;
  await api("POST", `/api/rooms/${soloRoom.id}/agents`, { agentId: ari.id });
  const tooFew = await api("POST", "/api/discussions", {
    workspaceId,
    roomId: soloRoom.id,
    topic: "Anything",
  });
  check("one-agent room → 422", tooFew.status === 422, `got ${tooFew.status}`);

  // Explicit single agent is also too few.
  const oneExplicit = await api("POST", "/api/discussions", {
    workspaceId,
    roomId: room.id,
    topic: "Anything",
    agentIds: [ari.id],
  });
  check("single explicit agent → 422", oneExplicit.status === 422, `got ${oneExplicit.status}`);

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
  const foreign = await api("POST", "/api/discussions", {
    workspaceId,
    roomId: otherRoom.id,
    topic: "Cross-workspace",
  });
  check("room from another workspace → 400", foreign.status === 400, `got ${foreign.status}`);

  // ====================================================================
  // RUN + PERSIST + LIST + DETAIL
  // ====================================================================
  console.log("\nDiscussions — run, persist, list, detail");
  const run = await api("POST", "/api/discussions", {
    workspaceId,
    roomId: room.id,
    topic: "Should we use SQLite or Postgres for the MVP?",
    rounds: 2,
  });
  check("run discussion → 201", run.status === 201, `got ${run.status}`);
  const disc = run.json?.discussion;
  check("returns a discussion id", Boolean(disc?.id));
  check("status completed", disc?.status === "completed", `got ${disc?.status}`);
  check(
    "2 agents × 2 rounds = 4 turns",
    Array.isArray(disc?.turns) && disc.turns.length === 4,
    `got ${disc?.turns?.length}`
  );
  check("turns alternate between both agents", new Set((disc?.turns ?? []).map((t) => t.agentId)).size === 2);
  check("each turn has content", (disc?.turns ?? []).every((t) => t.content?.trim()));
  check("each turn records provider/model", (disc?.turns ?? []).every((t) => t.provider && t.model));
  check("rounds span 1..2", new Set((disc?.turns ?? []).map((t) => t.round)).size === 2);
  check("has a non-empty summary", Boolean(disc?.summary?.trim()));
  check("consensus is an array", Array.isArray(disc?.consensus));
  check("disagreements is an array", Array.isArray(disc?.disagreements));
  check("no decision linked yet", disc?.decisionId === null);

  // Persisted in the DB.
  const persisted = await db.discussion.findUnique({
    where: { id: disc.id },
    include: { turns: true },
  });
  check("discussion persisted in DB", Boolean(persisted));
  check("persisted with 4 turns", persisted?.turns.length === 4);
  check("persisted workspaceId matches", persisted?.workspaceId === workspaceId);

  // Explicit participants in a chosen order.
  const explicit = await api("POST", "/api/discussions", {
    workspaceId,
    roomId: room.id,
    topic: "How should we structure the API?",
    agentIds: [cloudy.id, ari.id],
    rounds: 1,
  });
  check("run with explicit agents → 201", explicit.status === 201, `got ${explicit.status}`);
  check(
    "explicit run: 2 agents × 1 round = 2 turns",
    explicit.json?.discussion?.turns?.length === 2,
    `got ${explicit.json?.discussion?.turns?.length}`
  );

  // Rounds clamping: an out-of-range value is clamped to the max (4).
  const clamped = await api("POST", "/api/discussions", {
    workspaceId,
    roomId: room.id,
    topic: "Stress test the rounds limit",
    rounds: 99,
  });
  check("run with rounds=99 → 201", clamped.status === 201, `got ${clamped.status}`);
  check(
    "rounds clamped to 4 (2 agents × 4 = 8 turns)",
    clamped.json?.discussion?.turns?.length === 8,
    `got ${clamped.json?.discussion?.turns?.length}`
  );

  // List now has the discussions, newest first, with turn counts.
  const list = await api("GET", `/api/discussions?workspaceId=${workspaceId}`);
  check("list now has discussions", (list.json?.discussions ?? []).length >= 3);
  check(
    "list carries a turnCount",
    (list.json?.discussions ?? []).every((d) => typeof d.turnCount === "number")
  );
  check(
    "listed newest first",
    (() => {
      const ts = (list.json?.discussions ?? []).map((d) => new Date(d.createdAt).getTime());
      return ts.every((v, i) => i === 0 || ts[i - 1] >= v);
    })(),
    "createdAt not descending"
  );

  // Detail endpoint returns the full turns.
  const detail = await api("GET", `/api/discussions/${disc.id}`);
  check("GET detail → 200", detail.status === 200, `got ${detail.status}`);
  check("detail includes turns", detail.json?.discussion?.turns?.length === 4);
  check("detail topic matches", detail.json?.discussion?.topic === disc.topic);

  check(
    "GET unknown discussion → 404",
    (await api("GET", "/api/discussions/does-not-exist")).status === 404
  );

  // Room filter narrows to that room.
  const filtered = await api(
    "GET",
    `/api/discussions?workspaceId=${workspaceId}&roomId=${room.id}`
  );
  const filteredIds = (filtered.json?.discussions ?? []).map((d) => d.id);
  check("room filter includes the room's discussion", filteredIds.includes(disc.id));
  check(
    "room filter excludes other rooms",
    (filtered.json?.discussions ?? []).every((d) => d.roomId === room.id)
  );

  // ====================================================================
  // DECISION FROM DISCUSSION
  // ====================================================================
  console.log("\nDiscussions — decision generation");
  const decRes = await api("POST", `/api/discussions/${disc.id}/decision`);
  check("generate decision → 201", decRes.status === 201, `got ${decRes.status}`);
  const decision = decRes.json?.decision;
  check("returns a decision id", Boolean(decision?.id));
  check("decision has a title", Boolean(decision?.title?.trim()));
  check("decision has a summary", Boolean(decision?.summary?.trim()));
  check("decision scoped to the room", decision?.roomId === room.id);
  check("actionItems is an array", Array.isArray(decision?.actionItems));

  // Decision persisted and linked back onto the discussion.
  const linked = await db.discussion.findUnique({ where: { id: disc.id } });
  check("discussion now links the decision", linked?.decisionId === decision.id);
  const decisionRow = await db.decision.findUnique({ where: { id: decision.id } });
  check("decision persisted in Decision model", Boolean(decisionRow));

  // The decision shows up in the workspace decision list.
  const decisionList = await api("GET", `/api/decisions?workspaceId=${workspaceId}`);
  check(
    "decision appears in /api/decisions",
    (decisionList.json?.decisions ?? []).some((d) => d.id === decision.id)
  );

  check(
    "decision for unknown discussion → 404",
    (await api("POST", "/api/discussions/nope/decision")).status === 404
  );

  // ====================================================================
  // PERMISSIONS
  // ====================================================================
  console.log("\nPermissions — member may run, viewer read-only, non-member denied");
  const other = await db.user.create({
    data: { email: `owner-${TAG}@example.com`, name: "Other Owner" },
  });
  const devUser = await db.user.findUnique({ where: { email: DEV_EMAIL } });

  async function seedAgents(wsId) {
    const a = await db.agent.create({
      data: {
        workspaceId: wsId, name: "ARi", displayName: "ARi",
        provider: "openai", model: "gpt-4o-mini", role: "Builder",
        systemPrompt: "You are ARi.",
      },
    });
    const c = await db.agent.create({
      data: {
        workspaceId: wsId, name: "Cloudy", displayName: "Cloudy",
        provider: "anthropic", model: "claude-3-5-sonnet-latest", role: "Reviewer",
        systemPrompt: "You are Cloudy.",
      },
    });
    return [a, c];
  }
  async function addRoomAgents(roomId, agentList) {
    for (const a of agentList) {
      await db.roomAgent.create({ data: { roomId, agentId: a.id } });
    }
  }

  // Workspace where the dev user is a member: can read AND run.
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
  const memberAgents = await seedAgents(memberWs.id);
  const memberRoom = await db.room.create({
    data: { workspaceId: memberWs.id, name: "Member room" },
  });
  await addRoomAgents(memberRoom.id, memberAgents);
  const memberRead = await api("GET", `/api/discussions?workspaceId=${memberWs.id}`);
  check("member can read discussions → 200", memberRead.status === 200);
  const memberRun = await api("POST", "/api/discussions", {
    workspaceId: memberWs.id,
    roomId: memberRoom.id,
    topic: "Member-run discussion",
    rounds: 1,
  });
  check("member can run a discussion → 201", memberRun.status === 201, `got ${memberRun.status}`);
  const memberDec = await api(
    "POST",
    `/api/discussions/${memberRun.json.discussion.id}/decision`
  );
  check("member can generate a decision → 201", memberDec.status === 201, `got ${memberDec.status}`);

  // Workspace where the dev user is only a viewer: read yes, run no.
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
  const viewerAgents = await seedAgents(viewerWs.id);
  const viewerRoom = await db.room.create({
    data: { workspaceId: viewerWs.id, name: "Viewer room" },
  });
  await addRoomAgents(viewerRoom.id, viewerAgents);
  // Seed a discussion directly so the viewer has something to (not) decide on.
  const viewerDisc = await db.discussion.create({
    data: {
      workspaceId: viewerWs.id, roomId: viewerRoom.id,
      topic: "Owner-seeded", rounds: 1, status: "completed", summary: "x",
    },
  });
  const viewerRead = await api("GET", `/api/discussions?workspaceId=${viewerWs.id}`);
  check("viewer can read discussions → 200", viewerRead.status === 200);
  check("viewer role reported", viewerRead.json?.role === "viewer");
  const viewerRun = await api("POST", "/api/discussions", {
    workspaceId: viewerWs.id,
    roomId: viewerRoom.id,
    topic: "Viewer-run attempt",
  });
  check("viewer cannot run a discussion → 403", viewerRun.status === 403, `got ${viewerRun.status}`);
  const viewerDec = await api("POST", `/api/discussions/${viewerDisc.id}/decision`);
  check("viewer cannot generate a decision → 403", viewerDec.status === 403, `got ${viewerDec.status}`);

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
  const strangerDisc = await db.discussion.create({
    data: {
      workspaceId: strangerWs.id, roomId: strangerRoom.id,
      topic: "Private", rounds: 1, status: "completed",
    },
  });
  check(
    "non-member cannot read discussions → 403",
    (await api("GET", `/api/discussions?workspaceId=${strangerWs.id}`)).status === 403
  );
  check(
    "non-member cannot run a discussion → 403",
    (await api("POST", "/api/discussions", {
      workspaceId: strangerWs.id,
      roomId: strangerRoom.id,
      topic: "Intrusion",
    })).status === 403
  );
  check(
    "non-member cannot read a discussion detail → 403",
    (await api("GET", `/api/discussions/${strangerDisc.id}`)).status === 403
  );
  check(
    "non-member cannot decide on a discussion → 403",
    (await api("POST", `/api/discussions/${strangerDisc.id}/decision`)).status === 403
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
