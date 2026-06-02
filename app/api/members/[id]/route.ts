import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
  unauthorized,
  requireMembership,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeMember } from "@/lib/serialize";
import type { WorkspaceRole } from "@/types";

type Params = { params: Promise<{ id: string }> };

const ASSIGNABLE_ROLES: WorkspaceRole[] = ["admin", "member", "viewer"];

// PATCH /api/members/[id] — change a member's role (admin/owner only).
// The workspace owner's role cannot be changed here.
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const member = await db.workspaceMember.findUnique({ where: { id } });
    if (!member) return notFound("Member not found");

    const role = await requireMembership(user.id, member.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can change member roles");

    if (member.role === "owner")
      return badRequest("The owner's role cannot be changed");

    const { role: newRole } = await req.json();
    if (!ASSIGNABLE_ROLES.includes(newRole))
      return badRequest("Role must be admin, member, or viewer");

    const updated = await db.workspaceMember.update({
      where: { id },
      data: { role: newRole },
      include: { user: true },
    });
    return ok(serializeMember(updated));
  } catch (err) {
    console.error("[PATCH /api/members/:id]", err);
    return serverError();
  }
}

// DELETE /api/members/[id] — remove a member from the workspace (admin/owner).
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const member = await db.workspaceMember.findUnique({ where: { id } });
    if (!member) return notFound("Member not found");

    const role = await requireMembership(user.id, member.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can remove members");

    if (member.role === "owner")
      return badRequest("The owner cannot be removed");

    await db.workspaceMember.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/members/:id]", err);
    return serverError();
  }
}
