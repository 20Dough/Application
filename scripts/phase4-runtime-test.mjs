// Phase 4 runtime test — exercises the AI Agent Foundation end-to-end against a
// running dev server (http://localhost:3000) plus direct Prisma seeding for the
// permission scenarios the single fixed dev user cannot reach alone.
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/phase4-runtime-test.mjs
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
const TAG = `t4-${Date.now()}`;

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

async function main() {
  console.log(`\nPhase 4 runtime test against ${BASE}\n`);

  // --- Workspace creation seeds the default AI team --------------------
  console.log("Default agent seeding");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "agent runtime test",
  });
  check("POST /api/workspaces → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  const list1 = await api("GET", `/api/agents?workspaceId=${workspaceId}`);
  check("GET /api/agents → 200", list1.status === 200, `got ${list1.status}`);
  const names = (list1.json?.agents ?? []).map((a) => a.name).sort();
  check("seeded ARi and Cloudy", JSON.stringify(names) === JSON.stringify(["ARi", "Cloudy"]), names.join(","));
  const ari = list1.json.agents.find((a) => a.name === "ARi");
  const cloudy = list1.json.agents.find((a) => a.name === "Cloudy");
  check("ARi → openai", ari?.provider === "openai", ari?.provider);
  check("Cloudy → anthropic", cloudy?.provider === "anthropic", cloudy?.provider);
  check("agents are active by default", ari?.isActive === true && cloudy?.isActive === true);
  check("current user role is owner", list1.json?.role === "owner");

  // --- Seeding is idempotent -------------------------------------------
  console.log("\nSeed idempotency");
  const reseed = await api("POST", "/api/agents/seed", { workspaceId });
  check("re-seed → 200", reseed.status === 200, `got ${reseed.status}`);
  check("re-seed creates nothing", reseed.json?.createdCount === 0, `created ${reseed.json?.createdCount}`);

  // --- Create a custom agent + validation ------------------------------
  console.log("\nCustom agent creation + validation");
  const badProvider = await api("POST", "/api/agents", {
    workspaceId,
    name: "Bad",
    provider: "nope",
    role: "x",
    systemPrompt: "x",
  });
  check("unknown provider → 400", badProvider.status === 400, `got ${badProvider.status}`);

  const badName = await api("POST", "/api/agents", {
    workspaceId,
    name: "has spaces",
    provider: "openai",
    role: "x",
    systemPrompt: "x",
  });
  check("invalid handle → 400", badName.status === 400, `got ${badName.status}`);

  const placeholderProvider = await api("POST", "/api/agents", {
    workspaceId,
    name: "Gem",
    provider: "gemini",
    role: "x",
    systemPrompt: "x",
  });
  check("placeholder provider (gemini) → 400", placeholderProvider.status === 400, `got ${placeholderProvider.status}`);

  const createAgent = await api("POST", "/api/agents", {
    workspaceId,
    name: "Researcher",
    provider: "openai",
    role: "Research Analyst",
    systemPrompt: "You research things.",
  });
  check("valid create → 201", createAgent.status === 201, `got ${createAgent.status}`);
  const researcher = createAgent.json?.agent;
  check("display name defaults to handle", researcher?.displayName === "Researcher");
  check("model defaults to provider default", researcher?.model === "gpt-4o", researcher?.model);

  const dupe = await api("POST", "/api/agents", {
    workspaceId,
    name: "Researcher",
    provider: "openai",
    role: "x",
    systemPrompt: "x",
  });
  check("duplicate handle → 409", dupe.status === 409, `got ${dupe.status}`);

  // --- Update: provider/model pair, active toggle, immutable handle ----
  console.log("\nAgent update");
  const changeProvider = await api("PATCH", `/api/agents/${researcher.id}`, {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
  });
  check("change provider/model → 200", changeProvider.status === 200, `got ${changeProvider.status}`);
  check("provider updated", changeProvider.json?.agent?.provider === "anthropic");

  const mismatch = await api("PATCH", `/api/agents/${researcher.id}`, {
    provider: "openai",
    model: "claude-3-5-sonnet-20241022",
  });
  check("provider/model mismatch → 400", mismatch.status === 400, `got ${mismatch.status}`);

  const deactivate = await api("PATCH", `/api/agents/${researcher.id}`, {
    isActive: false,
  });
  check("deactivate → 200", deactivate.status === 200);
  check("agent now inactive", deactivate.json?.agent?.isActive === false);

  const renameAttempt = await api("PATCH", `/api/agents/${researcher.id}`, {
    name: "Renamed",
  });
  // name is not an accepted field; with nothing else to update this is a 400.
  check("handle is immutable (rename rejected) → 400", renameAttempt.status === 400, `got ${renameAttempt.status}`);
  const stillResearcher = await db.agent.findUnique({ where: { id: researcher.id } });
  check("handle unchanged in DB", stillResearcher?.name === "Researcher");

  // --- Single agent profile fetch -------------------------------------
  console.log("\nAgent profile fetch");
  const profile = await api("GET", `/api/agents/${researcher.id}`);
  check("GET /api/agents/[id] → 200", profile.status === 200);
  check("profile returns full systemPrompt", typeof profile.json?.agent?.systemPrompt === "string");

  // --- Delete ----------------------------------------------------------
  console.log("\nAgent deletion");
  const del = await api("DELETE", `/api/agents/${researcher.id}`);
  check("DELETE → 200", del.status === 200);
  const gone = await db.agent.findUnique({ where: { id: researcher.id } });
  check("agent removed from DB", gone === null);

  // --- Permissions: viewer cannot manage, non-member denied -----------
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
  await db.agent.create({
    data: {
      workspaceId: viewerWs.id,
      name: "Helper",
      displayName: "Helper",
      provider: "openai",
      model: "gpt-4o",
      role: "Helper",
      systemPrompt: "help",
    },
  });

  const viewerList = await api("GET", `/api/agents?workspaceId=${viewerWs.id}`);
  check("viewer can list agents → 200", viewerList.status === 200, `got ${viewerList.status}`);
  check("viewer role reported", viewerList.json?.role === "viewer");

  const viewerCreate = await api("POST", "/api/agents", {
    workspaceId: viewerWs.id,
    name: "Sneaky",
    provider: "openai",
    role: "x",
    systemPrompt: "x",
  });
  check("viewer cannot create agent → 403", viewerCreate.status === 403, `got ${viewerCreate.status}`);

  // Workspace the dev user never joined.
  const strangerWs = await db.workspace.create({
    data: {
      name: `${TAG}-stranger`,
      ownerId: other.id,
      members: { create: { userId: other.id, role: "owner" } },
    },
  });
  const denied = await api("GET", `/api/agents?workspaceId=${strangerWs.id}`);
  check("non-member list → 403", denied.status === 403, `got ${denied.status}`);
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
