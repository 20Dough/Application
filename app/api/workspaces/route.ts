import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

// GET /api/workspaces
// Returns all workspaces where the current user is a member, including the
// current user's role in each.
export async function GET() {
  try {
    const user = await requireUser();

    const memberships = await db.workspaceMember.findMany({
      where: { userId: user.id },
      orderBy: { workspace: { updatedAt: "desc" } },
      include: {
        workspace: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            _count: { select: { members: true } },
          },
        },
      },
    });

    const workspaces = memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
      memberCount: m.workspace._count.members,
    }));

    return NextResponse.json({ workspaces });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/workspaces
// Creates a new workspace, sets the current user as owner, and creates the
// matching WorkspaceMember record with role = "owner".
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : null;

    if (!name) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    // Create the workspace and the owner membership atomically.
    const workspace = await db.workspace.create({
      data: {
        name,
        description: description || null,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });

    return NextResponse.json(
      { workspace: { ...workspace, role: "owner" } },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
