import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  requireMembership,
  unauthorized,
  handleError,
} from "@/lib/api";
import { serializeRoom } from "@/lib/serialize";

// GET /api/rooms?workspaceId=
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId is required");

    const role = await requireMembership(user.id, workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const rooms = await db.room.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return ok(rooms.map(serializeRoom));
  } catch (err) {
    return handleError("GET /api/rooms", err);
  }
}

// POST /api/rooms
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { workspaceId, name, description, defaultAgentId } = await req.json();
    if (!workspaceId || !name?.trim())
      return badRequest("workspaceId and name are required");

    const role = await requireMembership(user.id, workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const room = await db.room.create({
      data: {
        workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        defaultAgentId: defaultAgentId || null,
        createdById: user.id,
      },
    });
    return ok(serializeRoom(room), { status: 201 });
  } catch (err) {
    return handleError("POST /api/rooms", err);
  }
}
