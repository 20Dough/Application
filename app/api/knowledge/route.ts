import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageKnowledge,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateKnowledgeCreate } from "@/lib/knowledge/validation";
import {
  ingestKnowledgeSource,
  KnowledgeIngestionError,
} from "@/lib/knowledge/ingestion";

// GET /api/knowledge?workspaceId=[&roomId=]
// Lists the knowledge sources in a workspace (metadata only — not chunk text).
// Any member may view knowledge: it feeds the AI context their own messages rely
// on. An optional roomId narrows the list to that room's sources plus
// workspace-wide ones (roomId null). Also returns the caller's role so the UI can
// gate management controls.
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);

    const roomId = request.nextUrl.searchParams.get("roomId");
    const where = roomId
      ? { workspaceId, OR: [{ roomId: null }, { roomId }] }
      : { workspaceId };

    const sources = await db.knowledgeSource.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        sourceType: true,
        status: true,
        charCount: true,
        chunkCount: true,
        roomId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      sources,
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/knowledge
// Adds a knowledge source to a workspace and ingests it (chunk → embed →
// persist). Owners/admins only. An optional roomId scopes the source to a single
// room; it is validated to belong to the workspace so knowledge can never leak
// across workspaces.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const workspaceId =
      typeof body?.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!canManageKnowledge(membership.role)) {
      throw new ForbiddenError("Only owners and admins can manage knowledge");
    }

    const result = validateKnowledgeCreate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // If scoped to a room, confirm the room belongs to this workspace.
    if (result.data.roomId) {
      const room = await db.room.findUnique({
        where: { id: result.data.roomId },
        select: { workspaceId: true },
      });
      if (!room || room.workspaceId !== workspaceId) {
        return NextResponse.json(
          { error: "Room does not belong to this workspace" },
          { status: 400 }
        );
      }
    }

    const source = await ingestKnowledgeSource({
      workspaceId,
      roomId: result.data.roomId,
      title: result.data.title,
      sourceType: result.data.sourceType,
      content: result.data.content,
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    if (error instanceof KnowledgeIngestionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
