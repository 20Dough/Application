import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { parseActionItems } from "@/lib/decisions/validation";

// GET /api/decisions?workspaceId=[&roomId=]
// Lists a workspace's decision summaries, newest first. Any member may view —
// decisions are part of the shared record the whole team relies on. An optional
// roomId narrows to that room's decisions plus workspace-wide ones (roomId
// null). Also returns the caller's role so the UI can gate the generate button.
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);

    const roomId = request.nextUrl.searchParams.get("roomId");
    const where = roomId
      ? { workspaceId, OR: [{ roomId: null }, { roomId }] }
      : { workspaceId };

    const decisions = await db.decision.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      decisions: decisions.map((d) => ({
        id: d.id,
        workspaceId: d.workspaceId,
        roomId: d.roomId,
        title: d.title,
        summary: d.summary,
        actionItems: parseActionItems(d.actionItems),
        createdAt: d.createdAt,
      })),
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
