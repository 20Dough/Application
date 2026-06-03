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
import { canAccessRoom } from "@/lib/rooms/passcode";
import { parseFileToText } from "@/lib/files/parse";
import { serializeAttachment } from "@/lib/serialize";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// GET /api/files?roomId= — attachments in a room (metadata only, no text).
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const roomId = new URL(req.url).searchParams.get("roomId");
    if (!roomId) return badRequest("roomId is required");

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!role) return forbidden("Not a member of this workspace");
    if (!canAccessRoom(room, req)) return forbidden("Room is locked");

    const attachments = await db.attachment.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
    });
    return ok(attachments.map((a) => serializeAttachment(a)));
  } catch (err) {
    console.error("[GET /api/files]", err);
    return serverError();
  }
}

// POST /api/files — upload a document (DOC/DOCX/XLSX/PDF/text), parse it to
// text, and store it so AI agents can read it. Returns the saved attachment.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const form = await req.formData();
    const file = form.get("file");
    const roomId = form.get("roomId");

    if (!(file instanceof File)) return badRequest("file is required");
    if (typeof roomId !== "string" || !roomId)
      return badRequest("roomId is required");
    if (file.size > MAX_FILE_SIZE) return badRequest("File exceeds 10 MB");

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!canSendMessages(role)) return forbidden("Viewers cannot upload files");
    if (!canAccessRoom(room, req)) return forbidden("Room is locked");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await parseFileToText(
      buffer,
      file.name,
      file.type || "application/octet-stream",
    );

    const attachment = await db.attachment.create({
      data: {
        roomId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        extractedText: text,
      },
    });

    return ok(serializeAttachment(attachment), { status: 201 });
  } catch (err) {
    console.error("[POST /api/files]", err);
    return serverError();
  }
}
