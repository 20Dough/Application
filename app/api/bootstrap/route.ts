import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized, handleError } from "@/lib/api";
import { ensureDefaultWorkspace } from "@/lib/bootstrap";
import {
  serializeAgent,
  serializeDecision,
  serializeMember,
  serializeMemory,
  serializeMessage,
  serializeProjectContext,
  serializeRoom,
  serializeUser,
  serializeWorkspace,
} from "@/lib/serialize";

// GET /api/bootstrap — everything the workspace UI needs in one call.
// Auto-creates the default workspace on a fresh database.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const workspace = await ensureDefaultWorkspace(user.id);
    const workspaceId = workspace.id;

    const [members, rooms, agents, projectContext, memory, decisions] =
      await Promise.all([
        db.workspaceMember.findMany({
          where: { workspaceId },
          include: { user: true },
          orderBy: { createdAt: "asc" },
        }),
        db.room.findMany({
          where: { workspaceId },
          orderBy: { createdAt: "asc" },
        }),
        db.agent.findMany({
          where: { workspaceId },
          orderBy: { createdAt: "asc" },
        }),
        db.projectContext.findMany({
          where: { workspaceId },
          orderBy: { createdAt: "asc" },
        }),
        db.memoryItem.findMany({
          where: { workspaceId },
          orderBy: { importance: "desc" },
        }),
        db.decision.findMany({
          where: { workspaceId },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    // Preload the first room's messages, but never auto-open a locked room.
    const firstRoom = rooms[0];
    const messages =
      firstRoom && !firstRoom.passcodeHash
        ? await db.message.findMany({
            where: { roomId: firstRoom.id },
            orderBy: { createdAt: "asc" },
            include: { user: true, agent: true },
          })
        : [];

    return ok({
      currentUser: serializeUser(user),
      workspace: serializeWorkspace(workspace),
      members: members.map(serializeMember),
      rooms: rooms.map(serializeRoom),
      agents: agents.map(serializeAgent),
      projectContext: projectContext.map(serializeProjectContext),
      memory: memory.map(serializeMemory),
      decisions: decisions.map(serializeDecision),
      activeRoomId: firstRoom?.id ?? null,
      messages: messages.map(serializeMessage),
    });
  } catch (err) {
    return handleError("GET /api/bootstrap", err);
  }
}
