"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, Attachment, Message, Room } from "@/types";
import type { SummaryRange } from "@/lib/summary/decision-summary";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";

interface ChatPanelProps {
  room: Room;
  messages: Message[];
  agents: Agent[];
  attachments: Attachment[];
  currentUserId?: string;
  sending?: boolean;
  onSend: (content: string, attachmentIds: string[]) => void;
  onUploadFile: (file: File) => Promise<Attachment>;
  onGenerateSummary?: (range: SummaryRange) => void;
  onSetPasscode?: () => void;
}

const SUMMARY_OPTIONS: { range: SummaryRange; label: string }[] = [
  { range: "recent30", label: "Last 30 messages" },
  { range: "2h", label: "Past 2 hours" },
  { range: "1d", label: "Past day" },
  { range: "project", label: "Whole project" },
];

export function ChatPanel({
  room,
  messages,
  agents,
  attachments,
  currentUserId,
  sending,
  onSend,
  onUploadFile,
  onGenerateSummary,
  onSetPasscode,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const agentsById = new Map(agents.map((a) => [a.id, a]));
  const attachmentsByMessage = new Map<string, Attachment[]>();
  for (const a of attachments) {
    if (!a.messageId) continue;
    const list = attachmentsByMessage.get(a.messageId) ?? [];
    list.push(a);
    attachmentsByMessage.set(a.messageId, list);
  }

  const isCreator = Boolean(currentUserId && room.createdById === currentUserId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  return (
    <section className="flex h-full flex-1 flex-col bg-hive-bg">
      {/* Room header */}
      <header className="flex items-center gap-3 border-b border-hive-border px-4 py-3">
        <span className="text-hive-muted">{room.isLocked ? "🔒" : "#"}</span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-hive-text">{room.name}</h2>
          {room.description && (
            <p className="text-xs text-hive-muted">{room.description}</p>
          )}
        </div>

        {isCreator && onSetPasscode && (
          <button
            type="button"
            onClick={onSetPasscode}
            className="rounded-md border border-hive-border px-2.5 py-1 text-xs text-hive-muted transition hover:border-hive-accent hover:text-hive-accent"
          >
            {room.isLocked ? "🔒 Passcode" : "🔓 Set passcode"}
          </button>
        )}

        {onGenerateSummary && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSummaryOpen((o) => !o)}
              className="rounded-md border border-hive-border px-2.5 py-1 text-xs text-hive-muted transition hover:border-hive-accent hover:text-hive-accent"
            >
              ✦ Summarize ▾
            </button>
            {summaryOpen && (
              <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-hive-border bg-hive-panel shadow-lg">
                {SUMMARY_OPTIONS.map((opt) => (
                  <button
                    key={opt.range}
                    type="button"
                    onClick={() => {
                      setSummaryOpen(false);
                      onGenerateSummary(opt.range);
                    }}
                    className="block w-full px-3 py-2 text-left text-xs text-hive-text transition hover:bg-hive-surface"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              agent={
                message.agentId ? agentsById.get(message.agentId) : undefined
              }
              attachments={attachmentsByMessage.get(message.id)}
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
        onUploadFile={onUploadFile}
      />
    </section>
  );
}
