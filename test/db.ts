import { db } from "@/lib/db";

// Truncate every table in FK-safe order (children before parents) so each test
// runs against a clean database.
export async function resetDb() {
  await db.session.deleteMany();
  await db.usageLog.deleteMany();
  await db.attachment.deleteMany();
  await db.message.deleteMany();
  await db.roomAgent.deleteMany();
  await db.decision.deleteMany();
  await db.memoryItem.deleteMany();
  await db.projectContext.deleteMany();
  await db.invitation.deleteMany();
  await db.room.deleteMany();
  await db.agent.deleteMany();
  await db.workspaceMember.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();
}

export { db };
