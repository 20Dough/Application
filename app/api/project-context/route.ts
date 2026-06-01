import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  serverError,
  requireMembership,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeProjectContext } from "@/lib/serialize";

// GET /api/project-context?workspaceId=
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId is required");

    const role = await requireMembership(user.id, workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const items = await db.projectContext.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return ok(items.map(serializeProjectContext));
  } catch (err) {
    console.error("[GET /api/project-context]", err);
    return serverError();
  }
}

// POST /api/project-context
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { workspaceId, title, content } = await req.json();
    if (!workspaceId || !title?.trim() || !content?.trim())
      return badRequest("workspaceId, title and content are required");

    const role = await requireMembership(user.id, workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage project context");

    const item = await db.projectContext.create({
      data: { workspaceId, title: title.trim(), content: content.trim() },
    });
    return ok(serializeProjectContext(item), { status: 201 });
  } catch (err) {
    console.error("[POST /api/project-context]", err);
    return serverError();
  }
}
