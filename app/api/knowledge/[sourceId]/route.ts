import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageKnowledge,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateKnowledgeUpdate } from "@/lib/knowledge/validation";

type RouteContext = { params: Promise<{ sourceId: string }> };

// GET /api/knowledge/[sourceId]
// Returns one knowledge source's metadata. The caller must be a member of its
// workspace. Chunk text is not returned here (it is internal to retrieval).
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { sourceId } = await params;

    const source = await db.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: "Knowledge source not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, source.workspaceId);
    return NextResponse.json({ source, role: membership.role });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/knowledge/[sourceId]
// Updates a source's metadata (title, room scope). Owners/admins only. Content
// is not editable — changing it would require re-chunking/re-embedding, which is
// done by deleting and re-adding a source. A new room scope is validated to
// belong to the same workspace; the change is propagated to the source's chunks
// so retrieval scoping stays correct.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { sourceId } = await params;

    const source = await db.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: "Knowledge source not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, source.workspaceId);
    if (!canManageKnowledge(membership.role)) {
      throw new ForbiddenError("Only owners and admins can manage knowledge");
    }

    const body = await request.json().catch(() => null);
    const result = validateKnowledgeUpdate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result.data.roomId) {
      const room = await db.room.findUnique({
        where: { id: result.data.roomId },
        select: { workspaceId: true },
      });
      if (!room || room.workspaceId !== source.workspaceId) {
        return NextResponse.json(
          { error: "Room does not belong to this workspace" },
          { status: 400 }
        );
      }
    }

    // Keep the denormalized roomId on the chunks in sync with the source so
    // retrieval scoping reflects the new scope.
    const updated = await db.$transaction(async (tx) => {
      const next = await tx.knowledgeSource.update({
        where: { id: sourceId },
        data: result.data,
      });
      if (result.data.roomId !== undefined) {
        await tx.knowledgeChunk.updateMany({
          where: { sourceId },
          data: { roomId: result.data.roomId },
        });
      }
      return next;
    });

    return NextResponse.json({ source: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/knowledge/[sourceId]
// Removes a knowledge source and all of its chunks (cascade). Owners/admins only.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { sourceId } = await params;

    const source = await db.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: "Knowledge source not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, source.workspaceId);
    if (!canManageKnowledge(membership.role)) {
      throw new ForbiddenError("Only owners and admins can manage knowledge");
    }

    await db.knowledgeSource.delete({ where: { id: sourceId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
