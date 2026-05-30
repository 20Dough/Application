import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageMemory,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateMemoryUpdate } from "@/lib/memory/validation";

type RouteContext = { params: Promise<{ memoryId: string }> };

// GET /api/memory/[memoryId]
// Returns a single memory item. The caller must be a member of its workspace.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { memoryId } = await params;

    const memoryItem = await db.memoryItem.findUnique({ where: { id: memoryId } });
    if (!memoryItem) {
      return NextResponse.json({ error: "Memory item not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(
      user.id,
      memoryItem.workspaceId
    );

    return NextResponse.json({ memoryItem, role: membership.role });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/memory/[memoryId]
// Updates a memory item (title, content, importance, room scope). Owners/admins
// only. A new room scope is validated to belong to the same workspace.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { memoryId } = await params;

    const memoryItem = await db.memoryItem.findUnique({ where: { id: memoryId } });
    if (!memoryItem) {
      return NextResponse.json({ error: "Memory item not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(
      user.id,
      memoryItem.workspaceId
    );
    if (!canManageMemory(membership.role)) {
      throw new ForbiddenError("Only owners and admins can manage memory");
    }

    const body = await request.json().catch(() => null);
    const result = validateMemoryUpdate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result.data.roomId) {
      const room = await db.room.findUnique({
        where: { id: result.data.roomId },
        select: { workspaceId: true },
      });
      if (!room || room.workspaceId !== memoryItem.workspaceId) {
        return NextResponse.json(
          { error: "Room does not belong to this workspace" },
          { status: 400 }
        );
      }
    }

    const updated = await db.memoryItem.update({
      where: { id: memoryId },
      data: result.data,
    });

    return NextResponse.json({ memoryItem: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/memory/[memoryId]
// Removes a memory item from the workspace. Owners/admins only.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { memoryId } = await params;

    const memoryItem = await db.memoryItem.findUnique({ where: { id: memoryId } });
    if (!memoryItem) {
      return NextResponse.json({ error: "Memory item not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(
      user.id,
      memoryItem.workspaceId
    );
    if (!canManageMemory(membership.role)) {
      throw new ForbiddenError("Only owners and admins can manage memory");
    }

    await db.memoryItem.delete({ where: { id: memoryId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
