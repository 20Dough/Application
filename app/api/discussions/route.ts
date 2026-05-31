import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canRunDiscussions,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import {
  validateDiscussionStart,
  parseConsensus,
  parseDisagreements,
} from "@/lib/discussion/validation";
import { runDiscussion, DiscussionError } from "@/lib/discussion/orchestrator";

// GET /api/discussions?workspaceId=[&roomId=]
// Lists a workspace's multi-agent discussions, newest first. Any member may
// view. An optional roomId narrows to that room. Turns are omitted here (the
// detail endpoint returns them); each entry carries its synthesis and turn
// count. Also returns the caller's role so the UI can gate the start control.
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);

    const roomId = request.nextUrl.searchParams.get("roomId");
    const where = roomId ? { workspaceId, roomId } : { workspaceId };

    const discussions = await db.discussion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { turns: true } } },
    });

    return NextResponse.json({
      discussions: discussions.map((d) => ({
        id: d.id,
        workspaceId: d.workspaceId,
        roomId: d.roomId,
        topic: d.topic,
        rounds: d.rounds,
        status: d.status,
        summary: d.summary ?? "",
        consensus: parseConsensus(d.consensus),
        disagreements: parseDisagreements(d.disagreements),
        decisionId: d.decisionId,
        turnCount: d._count.turns,
        createdAt: d.createdAt,
      })),
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/discussions
// Runs a multi-agent discussion in a room and persists it. Owners/admins/members
// may run a discussion (viewers are read-only). Body: { workspaceId, roomId,
// topic, agentIds?, rounds? }. The discussion is produced through the discussion
// orchestrator (which reuses the provider factory, Context Builder, and
// Knowledge/RAG); it runs synchronously and returns the full result with turns.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!canRunDiscussions(membership.role)) {
      throw new ForbiddenError("Viewers cannot run discussions");
    }

    const result = validateDiscussionStart(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Confirm the room belongs to this workspace — never discuss across them.
    const room = await db.room.findUnique({ where: { id: result.data.roomId } });
    if (!room || room.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Room does not belong to this workspace" },
        { status: 400 }
      );
    }

    const discussion = await runDiscussion(room, result.data, user.id);
    return NextResponse.json({ discussion }, { status: 201 });
  } catch (error) {
    // User-facing failures (too few agents, an invalid agent, every turn failing)
    // become a 422 with a safe message; everything else falls through.
    if (error instanceof DiscussionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return errorResponse(error);
  }
}
