import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
  requireMembership,
  unauthorized,
} from "@/lib/api";
import { canSendMessages } from "@/lib/permissions";
import { serializeMessage } from "@/lib/serialize";
import { routeMessage } from "@/lib/ai/ai-router";
import { canAccessRoom } from "@/lib/rooms/passcode";

// GET /api/messages?roomId=
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const roomId = new URL(req.url).searchParams.get("roomId");
    if (!roomId) return badRequest("roomId is required");

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!role) return forbidden("Not a member of this workspace");
    if (!canAccessRoom(room, req)) return forbidden("Room is locked");

    const messages = await db.message.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      include: { user: true, agent: true },
    });
    return ok(messages.map(serializeMessage));
  } catch (err) {
    console.error("[GET /api/messages]", err);
    return serverError();
  }
}

// POST /api/messages — sends a human message through the AI Router.
// Returns the saved human message plus any AI responses.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { roomId, content, attachmentIds } = await req.json();
    if (!roomId || !content?.trim())
      return badRequest("roomId and content are required");

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!role) return forbidden("Not a member of this workspace");
    if (!canSendMessages(role))
      return forbidden("Viewers cannot send messages");
    if (!canAccessRoom(room, req)) return forbidden("Room is locked");

    const result = await routeMessage({
      roomId,
      userId: user.id,
      content: content.trim(),
      attachmentIds: Array.isArray(attachmentIds) ? attachmentIds : [],
    });
    return ok(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/messages]", err);
    return serverError();
  }
}
