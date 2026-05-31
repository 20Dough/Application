import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import {
  parseConsensus,
  parseDisagreements,
} from "@/lib/discussion/validation";

// GET /api/discussions/[discussionId]
// Returns one discussion with its full ordered turns and synthesis. Any member
// of the discussion's workspace may view; non-members get a 403 (and a missing
// discussion a 404). Also returns the caller's role so the UI can gate the
// "generate decision" control.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ discussionId: string }> }
) {
  try {
    const user = await requireUser();
    const { discussionId } = await params;

    const discussion = await db.discussion.findUnique({
      where: { id: discussionId },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });
    if (!discussion) {
      return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, discussion.workspaceId);

    return NextResponse.json({
      discussion: {
        id: discussion.id,
        workspaceId: discussion.workspaceId,
        roomId: discussion.roomId,
        topic: discussion.topic,
        rounds: discussion.rounds,
        status: discussion.status,
        summary: discussion.summary ?? "",
        consensus: parseConsensus(discussion.consensus),
        disagreements: parseDisagreements(discussion.disagreements),
        decisionId: discussion.decisionId,
        createdAt: discussion.createdAt,
        turns: discussion.turns.map((t) => ({
          id: t.id,
          round: t.round,
          agentId: t.agentId,
          agentName: t.agentName,
          content: t.content,
          provider: t.provider,
          model: t.model,
          createdAt: t.createdAt,
        })),
      },
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
