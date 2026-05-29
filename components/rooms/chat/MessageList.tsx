"use client";

import { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";
import type { ChatMessage } from "./types";

// MessageList — the scrollable transcript of a room. Renders messages oldest →
// newest and keeps the view pinned to the latest message as new ones arrive.

export function MessageList({
  messages,
  currentUserId,
}: {
  messages: ChatMessage[];
  currentUserId: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message whenever the count changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="rounded-lg border border-dashed border-neutral-800 px-6 py-8 text-center text-sm text-neutral-500">
          No messages yet. Say something to get the room started.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex-1 space-y-4 overflow-y-auto px-1 py-2">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isOwn={
            message.senderType === "human" &&
            message.user?.id === currentUserId
          }
        />
      ))}
      <div ref={bottomRef} />
    </ul>
  );
}
