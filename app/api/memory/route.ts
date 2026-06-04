import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  serverError,
  requireMembership,
  unauthorized,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeMemory } from "@/lib/serialize";

// GET /api/memory?workspaceId=
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId is required");

    const role = await requireMembership(user.id, workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const items = await db.memoryItem.findMany({
      where: { workspaceId },
      orderBy: { importance: "desc" },
    });
    return ok(items.map(serializeMemory));
  } catch (err) {
    console.error("[GET /api/memory]", err);
    return serverError();
  }
}

// POST /api/memory
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { workspaceId, roomId, title, content, importance } =
      await req.json();
    if (!workspaceId || !title?.trim() || !content?.trim())
      return badRequest("workspaceId, title and content are required");

    const role = await requireMembership(user.id, workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage memory");

    const item = await db.memoryItem.create({
      data: {
        workspaceId,
        roomId: roomId || null,
        title: title.trim(),
        content: content.trim(),
        importance: Number(importance) || 1,
      },
    });
    return ok(serializeMemory(item), { status: 201 });
  } catch (err) {
    console.error("[POST /api/memory]", err);
    return serverError();
  }
}
