// Phase 11 runtime test — exercises the Knowledge & RAG feature end-to-end
// against a running dev server (http://localhost:3000), plus direct Prisma
// seeding for the permission scenarios the single fixed dev user cannot reach
// alone. Covers: ingestion (chunk + embed), listing, metadata update, deletion,
// workspace- vs room-scoped retrieval, relevance ranking, the search endpoint,
// injection of retrieved knowledge into the AI Router's reply, and role
// boundaries (member/viewer read-only, non-member denied).
//
// Run with: DATABASE_URL="file:./dev.db" node scripts/phase11-runtime-test.mjs
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
const TAG = `t11-${Date.now()}`;

async function cleanup() {
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

// Distinct topical documents so retrieval has clear winners/losers to rank.
const SOLAR_DOC = `The HiveMind solar deployment runs on rooftop photovoltaic panels.
Each panel array feeds an inverter that converts DC to AC for the building grid.
Battery storage covers cloudy days and evening demand. Maintenance is quarterly.`;

const COFFEE_DOC = `The office coffee policy: fresh beans are ground each morning.
Espresso machines are descaled weekly. Decaf is available after 3pm.
Please rinse your mug; the dishwasher runs at 6pm daily.`;

const ROOM_DOC = `Project Falcon is the codename for the Q3 mobile launch.
The Falcon beta ships to internal testers first, then a staged public rollout.`;

async function main() {
  console.log(`\nPhase 11 runtime test against ${BASE}\n`);

  // --- Setup: a workspace (auto-seeds ARi + Cloudy) + two rooms ----------
  console.log("Setup");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "knowledge & RAG runtime test",
  });
  check("create workspace → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  const room = (await api("POST", "/api/rooms", { workspaceId, name: "General" }))
    .json.room;
  check("create room → 201", Boolean(room?.id));
  const otherRoom = (
    await api("POST", "/api/rooms", { workspaceId, name: "Falcon" })
  ).json.room;
  check("create second room → 201", Boolean(otherRoom?.id));

  // ====================================================================
  // INGESTION + VALIDATION
  // ====================================================================
  console.log("\nKnowledge — empty + validation");
  const knEmpty = await api("GET", `/api/knowledge?workspaceId=${workspaceId}`);
  check("GET knowledge → 200", knEmpty.status === 200, `got ${knEmpty.status}`);
  check("starts empty", (knEmpty.json?.sources ?? []).length === 0);
  check("role reported as owner", knEmpty.json?.role === "owner");

  check(
    "missing workspaceId → 400",
    (await api("GET", "/api/knowledge")).status === 400
  );
  check(
    "blank title → 400",
    (await api("POST", "/api/knowledge", {
      workspaceId,
      title: "  ",
      content: "x",
    })).status === 400
  );
  check(
    "blank content → 400",
    (await api("POST", "/api/knowledge", {
      workspaceId,
      title: "Empty",
      content: "   ",
    })).status === 400
  );
  check(
    "unknown source type → 400",
    (await api("POST", "/api/knowledge", {
      workspaceId,
      title: "Bad type",
      content: "hello world",
      sourceType: "spreadsheet",
    })).status === 400
  );

  console.log("\nKnowledge — ingest (chunk + embed)");
  const solar = await api("POST", "/api/knowledge", {
    workspaceId,
    title: "Solar deployment",
    content: SOLAR_DOC,
    sourceType: "document",
  });
  check("ingest document → 201", solar.status === 201, `got ${solar.status}`);
  const solarId = solar.json?.source?.id;
  check("returns created source", Boolean(solarId));
  check("status ready", solar.json?.source?.status === "ready");
  check("chunkCount ≥ 1", (solar.json?.source?.chunkCount ?? 0) >= 1);
  check(
    "charCount matches content",
    solar.json?.source?.charCount === SOLAR_DOC.length,
    `got ${solar.json?.source?.charCount}`
  );

  // Chunks + embeddings actually persisted.
  const chunkCount = await db.knowledgeChunk.count({ where: { sourceId: solarId } });
  check("chunks persisted", chunkCount >= 1, `count ${chunkCount}`);
  const sampleChunk = await db.knowledgeChunk.findFirst({ where: { sourceId: solarId } });
  const embedding = sampleChunk ? JSON.parse(sampleChunk.embedding) : [];
  check("chunk has a non-empty embedding vector", Array.isArray(embedding) && embedding.length > 0);
  check(
    "chunk dimensions match stored value",
    sampleChunk?.dimensions === embedding.length,
    `dim ${sampleChunk?.dimensions} vs ${embedding.length}`
  );

  const coffee = await api("POST", "/api/knowledge", {
    workspaceId,
    title: "Coffee policy",
    content: COFFEE_DOC,
  });
  check("ingest second source → 201", coffee.status === 201);

  // Room-scoped source — only retrievable in its room (+ never in other rooms).
  const falcon = await api("POST", "/api/knowledge", {
    workspaceId,
    title: "Project Falcon",
    content: ROOM_DOC,
    roomId: otherRoom.id,
  });
  check("room-scoped ingest → 201", falcon.status === 201, `got ${falcon.status}`);
  check("roomId persisted on source", falcon.json?.source?.roomId === otherRoom.id);

  // Cross-workspace room rejection.
  const stranger = await db.workspace.create({
    data: {
      name: `${TAG}-foreignws`,
      ownerId: (await db.user.findUnique({ where: { email: DEV_EMAIL } })).id,
    },
  });
  const foreignRoom = await db.room.create({
    data: { workspaceId: stranger.id, name: "Foreign" },
  });
  check(
    "room from another workspace → 400",
    (await api("POST", "/api/knowledge", {
      workspaceId,
      title: "Bad scope",
      content: "nope",
      roomId: foreignRoom.id,
    })).status === 400
  );

  console.log("\nKnowledge — list");
  const list = await api("GET", `/api/knowledge?workspaceId=${workspaceId}`);
  check("lists all workspace sources", (list.json?.sources ?? []).length === 3, `got ${(list.json?.sources ?? []).length}`);

  // ====================================================================
  // RETRIEVAL + SCOPING + RANKING
  // ====================================================================
  console.log("\nRetrieval — relevance ranking + scoping");
  const solarSearch = await api(
    "GET",
    `/api/knowledge/search?workspaceId=${workspaceId}&q=${encodeURIComponent("How do the solar panels and batteries work?")}`
  );
  check("search → 200", solarSearch.status === 200, `got ${solarSearch.status}`);
  const solarResults = solarSearch.json?.results ?? [];
  check("solar query returns results", solarResults.length > 0);
  check(
    "top result is the solar document",
    solarResults[0]?.sourceTitle === "Solar deployment",
    `got ${solarResults[0]?.sourceTitle}`
  );
  check(
    "scores are sorted descending",
    solarResults.every((r, i) => i === 0 || solarResults[i - 1].score >= r.score)
  );

  const coffeeSearch = await api(
    "GET",
    `/api/knowledge/search?workspaceId=${workspaceId}&q=${encodeURIComponent("When is decaf available and how are mugs cleaned?")}`
  );
  check(
    "coffee query ranks the coffee document first",
    (coffeeSearch.json?.results ?? [])[0]?.sourceTitle === "Coffee policy",
    `got ${(coffeeSearch.json?.results ?? [])[0]?.sourceTitle}`
  );

  check(
    "search missing q → 400",
    (await api("GET", `/api/knowledge/search?workspaceId=${workspaceId}`)).status === 400
  );

  console.log("\nRetrieval — room scoping");
  // Workspace-wide search (no room) must NOT surface the room-scoped Falcon doc.
  const wideFalcon = await api(
    "GET",
    `/api/knowledge/search?workspaceId=${workspaceId}&q=${encodeURIComponent("What is Project Falcon?")}`
  );
  const wideTitles = (wideFalcon.json?.results ?? []).map((r) => r.sourceTitle);
  check(
    "room-scoped source hidden from workspace-wide search",
    !wideTitles.includes("Project Falcon"),
    `titles: ${wideTitles.join(",")}`
  );
  // Searching within its room surfaces it.
  const roomFalcon = await api(
    "GET",
    `/api/knowledge/search?workspaceId=${workspaceId}&roomId=${otherRoom.id}&q=${encodeURIComponent("What is Project Falcon?")}`
  );
  const roomTitles = (roomFalcon.json?.results ?? []).map((r) => r.sourceTitle);
  check(
    "room-scoped source retrievable in its own room",
    roomTitles.includes("Project Falcon"),
    `titles: ${roomTitles.join(",")}`
  );

  // ====================================================================
  // INJECTION INTO THE AI ROUTER
  // ====================================================================
  console.log("\nIntegration — retrieved knowledge reaches the AI Router");
  const agents = (await api("GET", `/api/agents?workspaceId=${workspaceId}`)).json.agents;
  const ari = agents.find((a) => a.name === "ARi");
  await api("POST", `/api/rooms/${room.id}/agents`, { agentId: ari.id });
  const loop = await api("POST", `/api/rooms/${room.id}/messages`, {
    content: "@ARi how does our solar battery storage work?",
  });
  check("message send → 201", loop.status === 201, `got ${loop.status}`);
  const agentReply = (loop.json?.replies ?? []).find((m) => m.senderType === "agent");
  check("ARi responds", Boolean(agentReply));
  // The dev stub echoes the system prompt-grounded message; the injected
  // knowledge section is part of the system prompt. We assert the reply exists
  // and that retrieval for the same query (workspace-wide) finds the solar doc,
  // which is what the router injects.
  const routerRetrieval = await api(
    "GET",
    `/api/knowledge/search?workspaceId=${workspaceId}&roomId=${room.id}&q=${encodeURIComponent("how does our solar battery storage work?")}`
  );
  check(
    "router-equivalent retrieval surfaces the solar doc",
    (routerRetrieval.json?.results ?? [])[0]?.sourceTitle === "Solar deployment"
  );

  // ====================================================================
  // UPDATE + DELETE
  // ====================================================================
  console.log("\nKnowledge — update metadata + delete");
  const patch = await api("PATCH", `/api/knowledge/${solarId}`, {
    title: "Solar deployment (v2)",
  });
  check("update title → 200", patch.status === 200, `got ${patch.status}`);
  check("title updated", patch.json?.source?.title === "Solar deployment (v2)");

  // Re-scope to a room and confirm chunks follow (so retrieval scoping holds).
  const rescope = await api("PATCH", `/api/knowledge/${solarId}`, {
    roomId: room.id,
  });
  check("re-scope to room → 200", rescope.status === 200);
  const movedChunks = await db.knowledgeChunk.count({
    where: { sourceId: solarId, roomId: room.id },
  });
  check("chunks re-scoped to room", movedChunks >= 1, `count ${movedChunks}`);

  check(
    "patch unknown id → 404",
    (await api("PATCH", "/api/knowledge/nope", { title: "x" })).status === 404
  );
  check(
    "empty patch → 400",
    (await api("PATCH", `/api/knowledge/${solarId}`, {})).status === 400
  );

  const del = await api("DELETE", `/api/knowledge/${solarId}`);
  check("delete → 200", del.status === 200, `got ${del.status}`);
  check(
    "deleted source is gone",
    (await api("GET", `/api/knowledge/${solarId}`)).status === 404
  );
  const orphanChunks = await db.knowledgeChunk.count({ where: { sourceId: solarId } });
  check("deleting a source cascades to its chunks", orphanChunks === 0, `count ${orphanChunks}`);

  // ====================================================================
  // PERMISSIONS
  // ====================================================================
  console.log("\nPermissions — viewer/member read-only, non-member denied");
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
  await db.knowledgeSource.create({
    data: {
      workspaceId: viewerWs.id,
      title: "Seed",
      sourceType: "text",
      status: "ready",
    },
  });
  const viewerRead = await api("GET", `/api/knowledge?workspaceId=${viewerWs.id}`);
  check("viewer can read knowledge → 200", viewerRead.status === 200);
  check("viewer role reported", viewerRead.json?.role === "viewer");
  check(
    "viewer cannot add knowledge → 403",
    (await api("POST", "/api/knowledge", {
      workspaceId: viewerWs.id,
      title: "x",
      content: "y",
    })).status === 403
  );

  // Workspace where the dev user is a member: read yes, write no.
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
  check(
    "member can read knowledge → 200",
    (await api("GET", `/api/knowledge?workspaceId=${memberWs.id}`)).status === 200
  );
  check(
    "member cannot add knowledge → 403",
    (await api("POST", "/api/knowledge", {
      workspaceId: memberWs.id,
      title: "x",
      content: "y",
    })).status === 403
  );

  // Workspace the dev user never joined → fully denied.
  const strangerWs = await db.workspace.create({
    data: {
      name: `${TAG}-stranger`,
      ownerId: other.id,
      members: { create: { userId: other.id, role: "owner" } },
    },
  });
  const strangerSource = await db.knowledgeSource.create({
    data: {
      workspaceId: strangerWs.id,
      title: "Private",
      sourceType: "text",
      status: "ready",
    },
  });
  check(
    "non-member cannot list knowledge → 403",
    (await api("GET", `/api/knowledge?workspaceId=${strangerWs.id}`)).status === 403
  );
  check(
    "non-member cannot search knowledge → 403",
    (await api("GET", `/api/knowledge/search?workspaceId=${strangerWs.id}&q=test`)).status === 403
  );
  check(
    "non-member cannot delete a foreign source → 403",
    (await api("DELETE", `/api/knowledge/${strangerSource.id}`)).status === 403
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
