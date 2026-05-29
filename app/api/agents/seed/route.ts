import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageAgents,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { seedDefaultAgents } from "@/lib/agents/seed";

// POST /api/agents/seed
// Restores the default agents (ARi, Cloudy) for a workspace. Idempotent:
// existing agents are left untouched, so this only fills in any that are
// missing. Owners/admins only.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const workspaceId =
      typeof body?.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!canManageAgents(membership.role)) {
      throw new ForbiddenError("Only owners and admins can seed agents");
    }

    const created = await seedDefaultAgents(workspaceId);

    return NextResponse.json({ created, createdCount: created.length });
  } catch (error) {
    return errorResponse(error);
  }
}
