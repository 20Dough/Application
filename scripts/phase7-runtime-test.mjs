// Phase 7 runtime test — exercises the Mention Parser + AI Router end-to-end
// against a running dev server (http://localhost:3000). With no provider API
// keys configured, the router uses the local stub provider, so the full
// collaboration loop (human → @mention → AI replies in-room) is exercised
// without network access. Prisma is used directly for the setup the single
// fixed dev user / public API cannot reach (deactivating an agent, creating a
// placeholder-provider agent to force the graceful-failure path).
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/phase7-runtime-test.mjs
// (the dev server must be running).

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

const TAG = `t7-${Date.now()}`;

const agentReplies = (r) =>
  (r.json?.replies ?? []).filter((m) => m.senderType === "agent");
const systemReplies = (r) =>
  (r.json?.replies ?? []).filter((m) => m.senderType === "system");

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function addAgent(roomId, agentId) {
  return api("POST", `/api/rooms/${roomId}/agents`, { agentId });
}

async function main() {
  console.log(`\nPhase 7 runtime test against ${BASE}\n`);

  // --- Setup: workspace (auto-seeds ARi + Cloudy) ------------------------
  console.log("Setup");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "AI routing runtime test",
  });
  check("create workspace → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;

  const agentList = await api("GET", `/api/agents?workspaceId=${workspaceId}`);
  const ari = agentList.json.agents.find((a) => a.name === "ARi");
  const cloudy = agentList.json.agents.find((a) => a.name === "Cloudy");
  check("workspace seeded ARi + Cloudy", Boolean(ari && cloudy));

  // Room A: both agents, no default agent.
  const roomA = (await api("POST", "/api/rooms", { workspaceId, name: "Room A" }))
    .json.room;
  await addAgent(roomA.id, ari.id);
  await addAgent(roomA.id, cloudy.id);

  // --- Single mention → only that agent responds (rule 1) ----------------
  console.log("\nSingle mention");
  const one = await api("POST", `/api/rooms/${roomA.id}/messages`, {
    content: "@ARi design the database",
  });
  check("send → 201", one.status === 201, `got ${one.status}`);
  check("human message echoed back", one.json?.message?.senderType === "human");
  const oneAgents = agentReplies(one);
  check("exactly one agent replied", oneAgents.length === 1, `got ${oneAgents.length}`);
  check("ARi is the responder", oneAgents[0]?.agentId === ari.id);
  check("reply senderType is agent", oneAgents[0]?.senderType === "agent");
  check("reply has non-empty content", (oneAgents[0]?.content ?? "").length > 0);
  check(
    "reply carries provider/model metadata",
    (() => {
      try {
        const m = JSON.parse(oneAgents[0]?.metadata ?? "{}");
        return m.provider === "openai" && typeof m.model === "string";
      } catch {
        return false;
      }
    })()
  );
  check(
    "reply linked to triggering message",
    (() => {
      try {
        return JSON.parse(oneAgents[0]?.metadata ?? "{}").triggeredByMessageId ===
          one.json.message.id;
      } catch {
        return false;
      }
    })()
  );

  // --- Case-insensitive mention (rule: @ari matches ARi) -----------------
  console.log("\nCase-insensitive mention");
  const lower = await api("POST", `/api/rooms/${roomA.id}/messages`, {
    content: "@ari and @CLOUDY please weigh in",
  });
  const lowerAgents = agentReplies(lower);
  check("two agents replied", lowerAgents.length === 2, `got ${lowerAgents.length}`);
  const respIds = lowerAgents.map((m) => m.agentId).sort();
  check(
    "both ARi and Cloudy responded (case-insensitive)",
    JSON.stringify(respIds) === JSON.stringify([ari.id, cloudy.id].sort())
  );

  // --- Mention metadata recorded on the human message --------------------
  console.log("\nMention metadata on human message");
  const human = await db.message.findUnique({ where: { id: lower.json.message.id } });
  const humanMeta = JSON.parse(human.metadata ?? "{}");
  check(
    "human message records mentionedAgentIds",
    Array.isArray(humanMeta.mentionedAgentIds) &&
      humanMeta.mentionedAgentIds.includes(ari.id) &&
      humanMeta.mentionedAgentIds.includes(cloudy.id)
  );
  check(
    "human message records rawMentions (normalized)",
    Array.isArray(humanMeta.rawMentions) &&
      humanMeta.rawMentions.includes("ari") &&
      humanMeta.rawMentions.includes("cloudy")
  );

  // --- No mention + default agent set → default responds (rule 3) --------
  console.log("\nNo mention → default agent");
  const roomB = (await api("POST", "/api/rooms", { workspaceId, name: "Room B" }))
    .json.room;
  await addAgent(roomB.id, ari.id);
  await addAgent(roomB.id, cloudy.id);
  await api("PATCH", `/api/rooms/${roomB.id}`, { defaultAgentId: cloudy.id });
  const def = await api("POST", `/api/rooms/${roomB.id}/messages`, {
    content: "where should we start?",
  });
  const defAgents = agentReplies(def);
  check("default agent responded", defAgents.length === 1 && defAgents[0].agentId === cloudy.id);

  // --- No mention + no default → ARi responds (rule 4) -------------------
  console.log("\nNo mention, no default → ARi fallback");
  const roomC = (await api("POST", "/api/rooms", { workspaceId, name: "Room C" }))
    .json.room;
  await addAgent(roomC.id, ari.id);
  await addAgent(roomC.id, cloudy.id);
  const fb = await api("POST", `/api/rooms/${roomC.id}/messages`, {
    content: "kicking things off",
  });
  const fbAgents = agentReplies(fb);
  check("ARi responded as fallback", fbAgents.length === 1 && fbAgents[0].agentId === ari.id);

  // --- Agent-free room → pure human-to-human, no AI reply ----------------
  console.log("\nAgent-free room stays human-only");
  const roomD = (await api("POST", "/api/rooms", { workspaceId, name: "Room D" }))
    .json.room;
  const h2h = await api("POST", `/api/rooms/${roomD.id}/messages`, {
    content: "just us humans here",
  });
  check("no AI replies in agent-free room", (h2h.json?.replies ?? []).length === 0);

  // --- Mention an agent not in the room → clear system notice (rule 6) ---
  console.log("\nMention agent not in room");
  const notInRoom = await api("POST", `/api/rooms/${roomD.id}/messages`, {
    content: "@ARi are you there?",
  });
  check("no agent responded", agentReplies(notInRoom).length === 0);
  const notice = systemReplies(notInRoom)[0];
  check("system notice returned", Boolean(notice), "expected a system message");
  check(
    "notice mentions ARi isn't in the room",
    (notice?.content ?? "").includes("ARi") && /room/i.test(notice?.content ?? "")
  );

  // --- Inactive mentioned agent does not respond (rule 5) ----------------
  console.log("\nInactive mentioned agent");
  await db.agent.update({ where: { id: cloudy.id }, data: { isActive: false } });
  const inactive = await api("POST", `/api/rooms/${roomA.id}/messages`, {
    content: "@Cloudy please review",
  });
  check("inactive agent did not respond", agentReplies(inactive).length === 0);
  check(
    "inactive notice returned",
    (systemReplies(inactive)[0]?.content ?? "").toLowerCase().includes("inactive")
  );
  await db.agent.update({ where: { id: cloudy.id }, data: { isActive: true } });

  // --- Provider failure degrades gracefully (rule 7) ---------------------
  console.log("\nProvider failure → graceful system message");
  // The Gemini adapter is a placeholder that always reports unavailable. Create
  // a Gemini-backed agent directly (the public API blocks placeholder providers)
  // and mention it: the router must save a "could not respond" system message,
  // not fail the whole request.
  const gem = await db.agent.create({
    data: {
      workspaceId,
      name: "Gemmy",
      displayName: "Gemmy",
      provider: "gemini",
      model: "gemini-1.5-pro",
      role: "Placeholder",
      systemPrompt: "Placeholder agent on an unavailable provider.",
    },
  });
  await addAgent(roomC.id, gem.id);
  const failMix = await api("POST", `/api/rooms/${roomC.id}/messages`, {
    content: "@Gemmy and @ARi take a look",
  });
  check("send still succeeds → 201", failMix.status === 201, `got ${failMix.status}`);
  const failAgents = agentReplies(failMix);
  check(
    "working agent (ARi) still responded",
    failAgents.some((m) => m.agentId === ari.id)
  );
  check(
    "failed agent yields a 'could not respond' system message",
    systemReplies(failMix).some((m) => /could not respond/i.test(m.content))
  );

  // --- Persistence: replies are saved and re-read in order ---------------
  console.log("\nPersistence");
  const reread = await api("GET", `/api/rooms/${roomA.id}/messages`);
  const kinds = (reread.json?.messages ?? []).map((m) => m.senderType);
  check("agent messages persisted in room", kinds.includes("agent"));
  check(
    "transcript ordered oldest → newest",
    (() => {
      const ts = (reread.json?.messages ?? []).map((m) => new Date(m.createdAt).getTime());
      return ts.every((t, i) => i === 0 || ts[i - 1] <= t);
    })()
  );
  const dbAgentCount = await db.message.count({
    where: { roomId: roomA.id, senderType: "agent" },
  });
  check("agent messages exist in DB", dbAgentCount >= 3, `db agent count ${dbAgentCount}`);

  // --- Frontend never reaches a real provider: stub marker present -------
  console.log("\nLocal stub in use (no API keys)");
  check(
    "stub-provider reply is clearly labelled a placeholder",
    /local AI placeholder/i.test(oneAgents[0]?.content ?? "")
  );

  // --- Usage logging -----------------------------------------------------
  console.log("\nUsage logging");
  const usage = await db.usageLog.count({ where: { workspaceId } });
  check("usage logged for AI calls", usage > 0, `usage rows ${usage}`);
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
