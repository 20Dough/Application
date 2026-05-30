"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canSendMessages } from "@/lib/roles";
import { useVisiblePolling } from "@/lib/hooks/use-visible-polling";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { ChatMessage } from "./types";

// RoomChat — stateful container for a room's conversation.
//
// Loads the room's messages, owns the composer, and posts new human messages.
// All access and permission rules are enforced by the API; this component
// mirrors the read-only check (viewers cannot send) only to shape the UI.
// Posting a message returns the human message plus any AI replies (and system
// notices) from the AI Router; all are merged into the conversation in order.
//
// Realtime: the chat polls for new messages on an interval, so messages posted
// by other people — and AI replies produced for them — appear without a manual
// reload. Each poll asks only for messages newer than the latest one shown, so
// the request stays small.

const POLL_INTERVAL_MS = 4000;

// Merges incoming messages into the existing list, de-duplicating by id (a poll
// re-returns the boundary message, and the sender already appended its own) and
// keeping them ordered oldest → newest. Returns the same array reference when
// nothing changed so React can skip a re-render.
function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((m) => [m.id, m]));
  let changed = false;
  for (const m of incoming) {
    if (!byId.has(m.id)) changed = true;
    byId.set(m.id, m);
  }
  if (!changed) return existing;
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function RoomChat({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Mirror of the current messages, read by the poller so the polling effect
  // doesn't depend on (and restart with) every message update.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const canSend = canSendMessages(role);

  // Full load — the initial transcript (and a recovery path on error).
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load messages");
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
      setRole(data.role ?? "viewer");
      setCurrentUserId(data.currentUserId ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Incremental poll — fetches only messages newer than the latest one shown and
  // merges them in. Silent on failure so a transient hiccup doesn't surface an
  // error over an otherwise-working conversation; the next tick retries.
  const pollNew = useCallback(async () => {
    const current = messagesRef.current;
    const latest = current[current.length - 1];
    const query = latest
      ? `?after=${encodeURIComponent(latest.createdAt)}`
      : "";
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages${query}`);
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.role === "string") setRole(data.role);
      const incoming: ChatMessage[] = data.messages ?? [];
      if (incoming.length > 0) {
        setMessages((prev) => mergeMessages(prev, incoming));
      }
    } catch {
      /* transient — retry on the next tick */
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useVisiblePolling(pollNew, POLL_INTERVAL_MS);

  const handleSend = useCallback(
    async (content: string) => {
      setSendError(null);
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSendError(data?.error || "Failed to send message");
        return;
      }
      const data = await res.json();
      // Merge the human message and any AI replies / system notices the router
      // produced. Merging (rather than a blind append) de-duplicates against
      // anything the poller may have already pulled in.
      const appended: ChatMessage[] = [];
      if (data.message) appended.push(data.message as ChatMessage);
      if (Array.isArray(data.replies)) {
        appended.push(...(data.replies as ChatMessage[]));
      }
      if (appended.length > 0) {
        setMessages((prev) => mergeMessages(prev, appended));
      }
    },
    [roomId]
  );

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-neutral-800">
      <div className="flex flex-1 flex-col overflow-hidden px-4 pt-3">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading messages…</p>
        ) : error ? (
          <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : (
          <MessageList messages={messages} currentUserId={currentUserId} />
        )}
      </div>

      <div className="space-y-2 border-t border-neutral-800 px-4 py-3">
        {sendError && (
          <p className="text-xs text-red-400">{sendError}</p>
        )}
        <MessageInput
          onSend={handleSend}
          canSend={!loading && !error && canSend}
          disabled={loading || Boolean(error)}
        />
      </div>
    </div>
  );
}
