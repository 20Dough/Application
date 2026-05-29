import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/permissions";
import { errorResponse } from "@/lib/api";

type RouteContext = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[workspaceId]/members
// Lists the human members of a workspace. Any member may view the roster.
// Also returns the current user's role so the UI can gate controls.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMember(user.id, workspaceId);

    const members = await db.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      // Owners first, then by join order.
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      members,
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
