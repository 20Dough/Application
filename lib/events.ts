// In-memory pub/sub event bus for realtime updates (SSE).
//
// Scope & limitations: this lives in the Node process, so it works for a single
// server instance — perfect for local/dev and small deployments. For multi-
// instance production you'd swap this for Redis pub/sub or a hosted realtime
// service; the publish/subscribe surface below is designed to make that swap
// easy.

import type { Message } from "@/types";

export type RoomEvent =
  | { type: "message"; message: Message }
  | { type: "ping" };

type Listener = (event: RoomEvent) => void;

// roomId -> set of listeners.
// Stored on globalThis so the publisher (/api/messages) and subscriber
// (/api/rooms/[roomId]/stream) share one instance even though Next.js bundles
// route handlers separately — same pattern as the Prisma client singleton.
const globalForEvents = globalThis as unknown as {
  roomListeners: Map<string, Set<Listener>> | undefined;
};

const roomListeners =
  globalForEvents.roomListeners ?? new Map<string, Set<Listener>>();

if (!globalForEvents.roomListeners) {
  globalForEvents.roomListeners = roomListeners;
}

/** Subscribe to events for a room. Returns an unsubscribe function. */
export function subscribeToRoom(
  roomId: string,
  listener: Listener,
): () => void {
  let set = roomListeners.get(roomId);
  if (!set) {
    set = new Set();
    roomListeners.set(roomId, set);
  }
  set.add(listener);

  return () => {
    const current = roomListeners.get(roomId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) roomListeners.delete(roomId);
  };
}

/** Broadcast an event to everyone listening on a room. */
export function publishToRoom(roomId: string, event: RoomEvent): void {
  const set = roomListeners.get(roomId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch (err) {
      console.error("[events] listener error:", err);
    }
  }
}
