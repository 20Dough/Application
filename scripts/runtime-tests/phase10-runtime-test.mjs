// Phase 10 runtime test — exercises the realtime room-update plumbing against a
// running dev server (http://localhost:3000), plus direct Prisma seeding for the
// multi-user permission scenario the single fixed dev user cannot reach alone.
//
// Phase 10 adds realtime refresh by polling. The UI piece (interval polling that
// pauses when the tab is hidden) is client-side; the server contract it relies
// on is the incremental message fetch: GET /api/rooms/[roomId]/messages?after=
// returns only messages at/after the cursor. This script verifies that contract
// end-to-end:
//   - the cursor excludes older messages and includes newer ones
//   - an inclusive bound never skips a message sharing the cursor's instant
//   - an invalid/empty cursor degrades to the full recent slice
//   - AI replies (produced by the router for a mentioned agent) surface through
//     the same incremental fetch, so a polling client sees them
//   - role / currentUserId are still reported, and access rules still hold
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/runtime-tests/phase10-runtime-test.mjs
// (the dev server must be running; the script also talks to the DB directly for
// the multi-user permission scenario).

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
const TAG = `t10-${Date.now()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

// Posts a human message and returns the persisted message record. A small delay
// after each post keeps timestamps distinct so cursor assertions are stable.
async function post(roomId, content) {
  const res = await api("POST", `/api/rooms/${roomId}/messages`, { content });
  check(`post "${content.slice(0, 24)}…" → 201`, res.status === 201, `got ${res.status}`);
  await sleep(8);
  return res.json;
}

async function incremental(roomId, after) {
  const res = await api(
    "GET",
    `/api/rooms/${roomId}/messages?after=${encodeURIComponent(after)}`
  );
  return res;
}

function ids(list) {
  return (list ?? []).map((m) => m.id);
}

async function main() {
  console.log(`\nPhase 10 runtime test against ${BASE}\n`);

  // --- Setup: a workspace (auto-seeds ARi + Cloudy) -----------------------
  console.log("Setup");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "realtime room updates runtime test",
  });
  check("create workspace → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  // ====================================================================
  // INCREMENTAL FETCH (human-only room — no agents, so no AI replies)
  // ====================================================================
  console.log("\nIncremental fetch — ?after cursor (human-only room)");
  const roomA = (await api("POST", "/api/rooms", { workspaceId, name: "Plain" }))
    .json.room;
  check("create room A → ok", Boolean(roomA?.id));

  const m1 = await post(roomA.id, "First message");
  const m2 = await post(roomA.id, "Second message");
  const m3 = await post(roomA.id, "Third message");

  // Full (no cursor) returns the whole transcript, oldest → newest.
  const full = await api("GET", `/api/rooms/${roomA.id}/messages`);
  check("GET (no cursor) → 200", full.status === 200, `got ${full.status}`);
  check("full list has all three", ids(full.json?.messages).length === 3);
  check(
    "full list ordered oldest → newest",
    JSON.stringify(ids(full.json?.messages)) ===
      JSON.stringify([m1.message.id, m2.message.id, m3.message.id])
  );
  check("role reported as owner", full.json?.role === "owner");
  check("currentUserId reported", Boolean(full.json?.currentUserId));

  // Cursor at m2: excludes the older m1, includes the newer m3.
  const afterM2 = await incremental(roomA.id, m2.message.createdAt);
  check("GET ?after → 200", afterM2.status === 200, `got ${afterM2.status}`);
  const afterM2Ids = ids(afterM2.json?.messages);
  check("after m2 excludes m1 (older)", !afterM2Ids.includes(m1.message.id));
  check("after m2 includes m3 (newer)", afterM2Ids.includes(m3.message.id));
  check(
    "after m2 inclusive of the boundary (m2 not skipped)",
    afterM2Ids.includes(m2.message.id)
  );

  // Cursor at m3: only the boundary remains; m1 and m2 are excluded.
  const afterM3Ids = ids((await incremental(roomA.id, m3.message.createdAt)).json?.messages);
  check("after m3 excludes m1 and m2", !afterM3Ids.includes(m1.message.id) && !afterM3Ids.includes(m2.message.id));

  // A future cursor yields nothing new — the "no updates" poll case.
  const future = new Date(Date.now() + 60_000).toISOString();
  check(
    "after a future cursor → empty",
    ids((await incremental(roomA.id, future)).json?.messages).length === 0
  );

  // An invalid cursor is ignored: the full recent slice is returned.
  const invalid = await incremental(roomA.id, "not-a-date");
  check("invalid ?after → 200", invalid.status === 200, `got ${invalid.status}`);
  check("invalid ?after falls back to full list", ids(invalid.json?.messages).includes(m1.message.id));

  // ====================================================================
  // AI REPLIES SURFACE THROUGH POLLING (room with an agent)
  // ====================================================================
  console.log("\nAI replies surface via incremental fetch (room with ARi)");
  const roomB = (await api("POST", "/api/rooms", { workspaceId, name: "WithARi" }))
    .json.room;
  const agents = (await api("GET", `/api/agents?workspaceId=${workspaceId}`)).json.agents;
  const ari = agents.find((a) => a.name === "ARi");
  check("workspace seeded ARi", Boolean(ari?.id));
  await api("POST", `/api/rooms/${roomB.id}/agents`, { agentId: ari.id });

  // Posting to ARi produces at least one agent reply (the dev stub stands in
  // when no provider key is set). A client that polled from before this post
  // must see both the human message and the agent reply.
  const p1 = await api("POST", `/api/rooms/${roomB.id}/messages`, {
    content: "@ARi should we ship Friday?",
  });
  check("post mentioning ARi → 201", p1.status === 201, `got ${p1.status}`);
  check("router returned at least one reply", Array.isArray(p1.json?.replies) && p1.json.replies.length >= 1);

  const sinceHuman = ids((await incremental(roomB.id, p1.json.message.createdAt)).json?.messages);
  check("incremental includes the human message", sinceHuman.includes(p1.json.message.id));
  const replyIds = (p1.json.replies ?? []).map((r) => r.id);
  check(
    "incremental surfaces the AI reply (visible to a poller)",
    replyIds.some((id) => sinceHuman.includes(id))
  );
  const agentReply = (p1.json.replies ?? []).find((r) => r.senderType === "agent");
  check("a reply is an agent message", Boolean(agentReply));

  // ====================================================================
  // ACCESS CONTROL — incremental fetch respects membership
  // ====================================================================
  console.log("\nAccess control — non-member denied on incremental fetch");
  const other = await db.user.create({
    data: { email: `owner-${TAG}@example.com`, name: "Other Owner" },
  });
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
  await db.message.create({
    data: {
      roomId: strangerRoom.id,
      senderType: "human",
      userId: other.id,
      content: "secret",
    },
  });
  const denied = await incremental(strangerRoom.id, new Date(0).toISOString());
  check("non-member incremental fetch → 403", denied.status === 403, `got ${denied.status}`);
  check(
    "unknown room → 404",
    (await api("GET", "/api/rooms/does-not-exist/messages?after=" + new Date(0).toISOString())).status === 404
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
