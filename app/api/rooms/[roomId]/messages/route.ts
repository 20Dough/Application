import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canSendMessages,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateMessageCreate } from "@/lib/messages/validation";
import { routeHumanMessage } from "@/lib/ai/ai-router";

type RouteContext = { params: Promise<{ roomId: string }> };

// How a message's human/agent author is presented to the client. Agent senders
// are supported in the schema (and rendered by the UI), but in this phase only
// humans actually post — AI responses arrive in a later phase.
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

const AGENT_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
} as const;

// Most recent N messages to load for a room. Pagination is deferred; rooms are
// small in the MVP and this keeps the chat responsive.
const MESSAGE_LIMIT = 200;

// GET /api/rooms/[roomId]/messages
// Returns the room's messages oldest → newest, with their human or agent
// authors. Any workspace member may read. The current user's role and id are
// returned so the UI can gate the composer (viewers are read-only) and mark the
// viewer's own messages.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { roomId } = await params;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, room.workspaceId);

    // Take the most recent slice, then present oldest → newest for display.
    const recent = await db.message.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_LIMIT,
      include: {
        user: { select: USER_SELECT },
        agent: { select: AGENT_SELECT },
      },
    });
    const messages = recent.reverse();

    return NextResponse.json({
      messages,
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/rooms/[roomId]/messages
// Posts a human message to the room, then runs the AI Router: any @mentioned
// (or default/fallback) agents respond in the same room. Any member who can send
// (owner/admin/member) may post; viewers are read-only. The response returns the
// human message plus the AI replies (and any system notices), oldest → newest.
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { roomId } = await params;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, room.workspaceId);
    if (!canSendMessages(membership.role)) {
      throw new ForbiddenError("Viewers cannot send messages in this room");
    }

    const body = await request.json().catch(() => null);
    const result = validateMessageCreate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        roomId,
        senderType: "human",
        userId: user.id,
        content: result.data.content,
      },
      include: {
        user: { select: USER_SELECT },
        agent: { select: AGENT_SELECT },
      },
    });

    // Hand the saved message to the AI Router. Mentioned (or default/fallback)
    // agents respond in-room; a provider failing never fails the human message.
    const replies = await routeHumanMessage(room, message);

    return NextResponse.json({ message, replies }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
