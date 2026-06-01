import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
  requireMembership,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeRoomAgent } from "@/lib/serialize";

// GET /api/room-agents?roomId= — agents attached to a room
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const roomId = new URL(req.url).searchParams.get("roomId");
    if (!roomId) return badRequest("roomId is required");

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const roomAgents = await db.roomAgent.findMany({
      where: { roomId },
      include: { agent: true },
      orderBy: { createdAt: "asc" },
    });
    return ok(roomAgents.map(serializeRoomAgent));
  } catch (err) {
    console.error("[GET /api/room-agents]", err);
    return serverError();
  }
}

// POST /api/room-agents — add an agent to a room (admin/owner only)
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { roomId, agentId } = await req.json();
    if (!roomId || !agentId)
      return badRequest("roomId and agentId are required");

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage room agents");

    // Ensure the agent belongs to the same workspace as the room.
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.workspaceId !== room.workspaceId)
      return badRequest("Agent does not belong to this workspace");

    const roomAgent = await db.roomAgent.upsert({
      where: { roomId_agentId: { roomId, agentId } },
      update: {},
      create: { roomId, agentId },
      include: { agent: true },
    });
    return ok(serializeRoomAgent(roomAgent), { status: 201 });
  } catch (err) {
    console.error("[POST /api/room-agents]", err);
    return serverError();
  }
}
