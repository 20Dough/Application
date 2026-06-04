import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, badRequest, unauthorized, handleError } from "@/lib/api";
import { serializeWorkspace } from "@/lib/serialize";

// GET /api/workspaces — workspaces the current user belongs to
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const memberships = await db.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(memberships.map((m) => serializeWorkspace(m.workspace)));
  } catch (err) {
    return handleError("GET /api/workspaces", err);
  }
}

// POST /api/workspaces — create a workspace (creator becomes owner)
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { name, description } = await req.json();
    if (!name?.trim()) return badRequest("name is required");

    const workspace = await db.workspace.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "owner" } },
      },
    });
    return ok(serializeWorkspace(workspace), { status: 201 });
  } catch (err) {
    return handleError("POST /api/workspaces", err);
  }
}
