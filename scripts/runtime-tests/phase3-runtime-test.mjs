// Phase 3 runtime test — exercises the Human Team System end-to-end against a
// running dev server (http://localhost:3000) plus direct Prisma seeding for the
// multi-user scenarios that the single fixed dev user cannot reach alone.
//
// Run with: node scripts/runtime-tests/phase3-runtime-test.mjs   (dev server must be up)

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
const TAG = `t3-${Date.now()}`;

async function cleanup() {
  // Remove anything tagged by this run (and seeded helper users).
  await db.workspace.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
}

async function main() {
  console.log(`\nPhase 3 runtime test against ${BASE}\n`);

  // --- Owner creates a workspace ---------------------------------------
  console.log("Workspace + owner membership");
  const created = await api("POST", "/api/workspaces", {
    name: `${TAG}-ws`,
    description: "runtime test",
  });
  check("POST /api/workspaces → 201", created.status === 201, `got ${created.status}`);
  const workspaceId = created.json?.workspace?.id;
  check("workspace has id", Boolean(workspaceId));

  const devUser = await db.user.findUnique({ where: { email: DEV_EMAIL } });
  check("dev user exists", Boolean(devUser));

  // --- Member roster ----------------------------------------------------
  console.log("\nMember roster");
  const members = await api("GET", `/api/workspaces/${workspaceId}/members`);
  check("GET members → 200", members.status === 200);
  check(
    "roster has exactly the owner",
    members.json?.members?.length === 1 &&
      members.json.members[0].role === "owner"
  );
  check("current user role is owner", members.json?.role === "owner");

  const ownerMemberId = members.json?.members?.[0]?.id;

  // Owner cannot be removed.
  const removeOwner = await api(
    "DELETE",
    `/api/workspaces/${workspaceId}/members/${ownerMemberId}`
  );
  check("DELETE owner membership → 403", removeOwner.status === 403, `got ${removeOwner.status}`);

  // --- Invitation validation -------------------------------------------
  console.log("\nInvitation creation + validation");
  const badEmail = await api("POST", "/api/invitations", {
    workspaceId,
    email: "not-an-email",
    role: "member",
  });
  check("invalid email → 400", badEmail.status === 400, `got ${badEmail.status}`);

  const badRole = await api("POST", "/api/invitations", {
    workspaceId,
    email: `alice-${TAG}@example.com`,
    role: "owner",
  });
  check("role 'owner' not assignable → 400", badRole.status === 400, `got ${badRole.status}`);

  const inviteEmail = `alice-${TAG}@example.com`;
  const invite = await api("POST", "/api/invitations", {
    workspaceId,
    email: inviteEmail,
    role: "member",
  });
  check("valid invite → 201", invite.status === 201, `got ${invite.status}`);
  const inviteId = invite.json?.invitation?.id;
  check("invite is pending", invite.json?.invitation?.status === "pending");

  const dupe = await api("POST", "/api/invitations", {
    workspaceId,
    email: inviteEmail.toUpperCase(), // case-insensitive duplicate
    role: "member",
  });
  check("duplicate pending invite → 409", dupe.status === 409, `got ${dupe.status}`);

  // Inviting an existing member (the owner) → 409.
  const inviteMember = await api("POST", "/api/invitations", {
    workspaceId,
    email: DEV_EMAIL,
    role: "member",
  });
  check("inviting an existing member → 409", inviteMember.status === 409, `got ${inviteMember.status}`);

  // List + revoke.
  const listInv = await api("GET", `/api/invitations?workspaceId=${workspaceId}`);
  check("GET invitations lists the invite", listInv.json?.invitations?.some((i) => i.id === inviteId));

  const revoke = await api("DELETE", `/api/invitations/${inviteId}`);
  check("DELETE invitation → 200", revoke.status === 200);
  const afterRevoke = await db.invitation.findUnique({ where: { id: inviteId } });
  check("invitation removed from DB", afterRevoke === null);

  // --- Accept flow (invitation addressed to the dev user) --------------
  console.log("\nAccept / reject flow");
  // Seed a workspace owned by a different user, then invite the dev user.
  const other = await db.user.create({
    data: { email: `owner-${TAG}@example.com`, name: "Other Owner" },
  });
  const otherWs = await db.workspace.create({
    data: {
      name: `${TAG}-other`,
      ownerId: other.id,
      members: { create: { userId: other.id, role: "owner" } },
    },
  });
  const acceptInvite = await db.invitation.create({
    data: { workspaceId: otherWs.id, email: DEV_EMAIL, role: "member", status: "pending" },
  });

  const myInvites = await api("GET", "/api/invitations");
  check(
    "GET /api/invitations shows my pending invite",
    myInvites.json?.invitations?.some((i) => i.id === acceptInvite.id)
  );

  const accept = await api("PATCH", `/api/invitations/${acceptInvite.id}`, {
    action: "accept",
  });
  check("accept → 200", accept.status === 200, `got ${accept.status}`);
  const newMembership = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: devUser.id, workspaceId: otherWs.id } },
  });
  check("membership created with invited role", newMembership?.role === "member");
  const acceptedInv = await db.invitation.findUnique({ where: { id: acceptInvite.id } });
  check("invitation marked accepted", acceptedInv?.status === "accepted");

  // Reject flow.
  const rejectInviteRow = await db.invitation.create({
    data: {
      workspaceId: otherWs.id,
      email: DEV_EMAIL,
      role: "viewer",
      status: "pending",
    },
  });
  // Dev user is already a member now; reject should still just mark rejected.
  const reject = await api("PATCH", `/api/invitations/${rejectInviteRow.id}`, {
    action: "reject",
  });
  check("reject → 200", reject.status === 200);
  const rejectedInv = await db.invitation.findUnique({ where: { id: rejectInviteRow.id } });
  check("invitation marked rejected", rejectedInv?.status === "rejected");

  // --- Member management (owner acting on a seeded member) -------------
  console.log("\nMember role change + removal");
  const teammate = await db.user.create({
    data: { email: `bob-${TAG}@example.com`, name: "Bob" },
  });
  const teammateMember = await db.workspaceMember.create({
    data: { userId: teammate.id, workspaceId, role: "member" },
  });

  const promote = await api(
    "PATCH",
    `/api/workspaces/${workspaceId}/members/${teammateMember.id}`,
    { role: "admin" }
  );
  check("owner promotes member → admin → 200", promote.status === 200, `got ${promote.status}`);
  check("returned role is admin", promote.json?.member?.role === "admin");

  const badPromote = await api(
    "PATCH",
    `/api/workspaces/${workspaceId}/members/${teammateMember.id}`,
    { role: "owner" }
  );
  check("cannot assign owner role → 400", badPromote.status === 400, `got ${badPromote.status}`);

  const removeMember = await api(
    "DELETE",
    `/api/workspaces/${workspaceId}/members/${teammateMember.id}`
  );
  check("owner removes member → 200", removeMember.status === 200, `got ${removeMember.status}`);
  const goneMember = await db.workspaceMember.findUnique({
    where: { id: teammateMember.id },
  });
  check("member removed from DB", goneMember === null);

  // --- Access control: non-member is rejected --------------------------
  console.log("\nNon-member access control");
  // otherWs is owned by `other`; the dev user accepted a member invite above,
  // so to test rejection we use a fresh workspace the dev user never joined.
  const strangerWs = await db.workspace.create({
    data: {
      name: `${TAG}-stranger`,
      ownerId: other.id,
      members: { create: { userId: other.id, role: "owner" } },
    },
  });
  const denied = await api("GET", `/api/workspaces/${strangerWs.id}/members`);
  check("non-member GET members → 403", denied.status === 403, `got ${denied.status}`);
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
