"use client";

import { useCallback, useEffect, useState } from "react";
import { canSendMessages } from "@/lib/roles";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { ChatMessage } from "./types";

// RoomChat — stateful container for a room's conversation.
//
// Loads the room's messages, owns the composer, and posts new human messages.
// All access and permission rules are enforced by the API; this component
// mirrors the read-only check (viewers cannot send) only to shape the UI. AI
// responses are not part of this phase, so sending only ever appends one human
// message.

export function RoomChat({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const canSend = canSendMessages(role);

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

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      // Append the newly created message rather than refetching the whole list.
      if (data.message) {
        setMessages((prev) => [...prev, data.message as ChatMessage]);
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
