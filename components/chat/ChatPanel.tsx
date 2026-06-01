"use client";

import { useEffect, useRef } from "react";
import type { Agent, Message, Room } from "@/types";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";

interface ChatPanelProps {
  room: Room;
  messages: Message[];
  agents: Agent[];
  sending?: boolean;
  onSend: (content: string) => void;
  onGenerateSummary?: () => void;
}

export function ChatPanel({
  room,
  messages,
  agents,
  sending,
  onSend,
  onGenerateSummary,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const agentsById = new Map(agents.map((a) => [a.id, a]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  return (
    <section className="flex h-full flex-1 flex-col bg-hive-bg">
      {/* Room header */}
      <header className="flex items-center gap-3 border-b border-hive-border px-4 py-3">
        <span className="text-hive-muted">#</span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-hive-text">{room.name}</h2>
          {room.description && (
            <p className="text-xs text-hive-muted">{room.description}</p>
          )}
        </div>
        {onGenerateSummary && (
          <button
            type="button"
            onClick={onGenerateSummary}
            className="rounded-md border border-hive-border px-2.5 py-1 text-xs text-hive-muted transition hover:border-hive-accent hover:text-hive-accent"
          >
            ✦ Summarize
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-hive-muted">
            No messages yet. Say hello or mention @ARi to get started.
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              agent={message.agentId ? agentsById.get(message.agentId) : undefined}
            />
          ))
        )}
        {sending && (
          <div className="px-4 py-2 text-xs text-hive-muted">
            AI teammates are thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        roomName={room.name}
        agents={agents}
        disabled={sending}
        onSend={onSend}
      />
    </section>
  );
}
