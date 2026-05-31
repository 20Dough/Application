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
  serializeActionItems,
  parseActionItems,
} from "@/lib/decisions/validation";
import {
  parseConsensus,
  parseDisagreements,
} from "@/lib/discussion/validation";
import {
  generateDecisionFromDiscussion,
  DiscussionError,
} from "@/lib/discussion/orchestrator";

// POST /api/discussions/[discussionId]/decision
// Generates a Decision from a completed discussion and persists it, linking it
// back onto the discussion (decisionId). Owners/admins/members may generate
// (viewers are read-only). The decision is produced through the discussion
// orchestrator and saved in the existing Decision model, scoped to the
// discussion's room so it surfaces in both the room and workspace decision lists.
export async function POST(
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
    if (!canRunDiscussions(membership.role)) {
      throw new ForbiddenError("Viewers cannot generate decisions");
    }

    const room = await db.room.findUnique({ where: { id: discussion.roomId } });
    if (!room) {
      return NextResponse.json({ error: "Discussion room not found" }, { status: 404 });
    }

    const draft = await generateDecisionFromDiscussion(room, {
      id: discussion.id,
      topic: discussion.topic,
      summary: discussion.summary,
      consensus: parseConsensus(discussion.consensus),
      disagreements: parseDisagreements(discussion.disagreements),
      turns: discussion.turns.map((t) => ({
        agentName: t.agentName,
        round: t.round,
        content: t.content,
      })),
    });

    // Persist the Decision and link it onto the discussion in one transaction so
    // the discussion always points at a Decision that exists.
    const decision = await db.$transaction(async (tx) => {
      const created = await tx.decision.create({
        data: {
          workspaceId: discussion.workspaceId,
          roomId: discussion.roomId,
          title: draft.title,
          summary: draft.summary,
          actionItems: serializeActionItems(draft.actionItems),
        },
      });
      await tx.discussion.update({
        where: { id: discussion.id },
        data: { decisionId: created.id },
      });
      return created;
    });

    return NextResponse.json(
      {
        decision: {
          id: decision.id,
          workspaceId: decision.workspaceId,
          roomId: decision.roomId,
          title: decision.title,
          summary: decision.summary,
          actionItems: parseActionItems(decision.actionItems),
          createdAt: decision.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DiscussionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return errorResponse(error);
  }
}
