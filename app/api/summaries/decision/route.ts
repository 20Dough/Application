import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canGenerateSummaries,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import {
  validateDecisionSummaryRequest,
  serializeActionItems,
  parseActionItems,
} from "@/lib/decisions/validation";
import {
  generateDecisionSummary,
  DecisionSummaryError,
} from "@/lib/ai/ai-router";

// POST /api/summaries/decision
// Generates an AI decision summary from a room's recent messages and persists
// it as a Decision. Owners/admins/members may generate (viewers are read-only).
// Body: { workspaceId, roomId, agentId? }. The summary is produced through the
// AI Router (the single place provider calls happen); the room is scoped on the
// resulting Decision so it surfaces in both room and workspace decision lists.
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
    if (!canGenerateSummaries(membership.role)) {
      throw new ForbiddenError("Viewers cannot generate decision summaries");
    }

    const result = validateDecisionSummaryRequest(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Confirm the room belongs to this workspace — never summarize across them.
    const room = await db.room.findUnique({ where: { id: result.data.roomId } });
    if (!room || room.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Room does not belong to this workspace" },
        { status: 400 }
      );
    }

    const draft = await generateDecisionSummary(room, {
      agentId: result.data.agentId,
    });

    const created = await db.decision.create({
      data: {
        workspaceId,
        roomId: room.id,
        title: draft.title,
        summary: draft.summary,
        actionItems: serializeActionItems(draft.actionItems),
      },
    });

    return NextResponse.json(
      {
        decision: {
          id: created.id,
          workspaceId: created.workspaceId,
          roomId: created.roomId,
          title: created.title,
          summary: created.summary,
          actionItems: parseActionItems(created.actionItems),
          createdAt: created.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // User-facing generation failures (no messages, no agent, provider down)
    // become a 422 with a safe message; everything else falls through.
    if (error instanceof DecisionSummaryError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return errorResponse(error);
  }
}
