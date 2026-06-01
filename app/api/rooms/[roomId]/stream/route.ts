import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getMemberRole } from "@/lib/permissions";
import { subscribeToRoom, type RoomEvent } from "@/lib/events";

type Params = { params: Promise<{ roomId: string }> };

// GET /api/rooms/[roomId]/stream — Server-Sent Events stream of new messages
// for a room. The client (EventSource) reconnects automatically if dropped.
export async function GET(_req: Request, { params }: Params) {
  const { roomId } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) return new Response("Not found", { status: 404 });

  const role = await getMemberRole(user.id, room.workspaceId);
  if (!role) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RoomEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      // Initial comment so the connection opens immediately.
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribeToRoom(roomId, send);

      // Heartbeat keeps proxies from closing an idle connection.
      const heartbeat = setInterval(() => send({ type: "ping" }), 25000);

      // Clean up when the client disconnects.
      _req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
