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
import { canSendMessages } from "@/lib/permissions";
import { serializeDecision } from "@/lib/serialize";
import { generateDecisionSummary } from "@/lib/summary/decision-summary";

// POST /api/summaries/decision — generate a decision summary from a room
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { roomId, title } = await req.json();
    if (!roomId) return badRequest("roomId is required");

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!canSendMessages(role))
      return forbidden("You do not have permission to generate summaries");

    const decision = await generateDecisionSummary({
      workspaceId: room.workspaceId,
      roomId,
      title,
    });
    return ok(serializeDecision(decision), { status: 201 });
  } catch (err) {
    console.error("[POST /api/summaries/decision]", err);
    return serverError();
  }
}
