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
import { verifyPasscode } from "@/lib/rooms/passcode";

type Params = { params: Promise<{ roomId: string }> };

// POST /api/rooms/[roomId]/verify — check a room passcode. Returns { unlocked }.
export async function POST(req: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const user = await getCurrentUser();
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    // Open rooms are always unlocked.
    if (!room.passcodeHash) return ok({ unlocked: true });

    const { passcode } = await req.json();
    if (!passcode) return badRequest("passcode is required");

    const valid = verifyPasscode(passcode, room.passcodeHash, room.passcodeSalt);
    if (!valid) return forbidden("Incorrect passcode");

    return ok({ unlocked: true });
  } catch (err) {
    console.error("[POST /api/rooms/:id/verify]", err);
    return serverError();
  }
}
