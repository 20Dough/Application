"use client";

import type { Agent, Message } from "@/types";
import { cn, formatTime, initials, providerColor } from "@/lib/utils";

interface MessageItemProps {
  message: Message;
  agent?: Agent;
}

export function MessageItem({ message, agent }: MessageItemProps) {
  // System messages render as a centered subtle notice.
  if (message.senderType === "system") {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-hive-panel px-3 py-1 text-xs text-hive-muted">
          {message.content}
        </span>
      </div>
    );
  }

  const isAgent = message.senderType === "agent";
  const name = message.senderName ?? (isAgent ? agent?.displayName : "Unknown");
  const accent = isAgent && agent ? providerColor(agent.provider) : "#8b949e";

  return (
    <div className="group flex gap-3 px-4 py-2 transition hover:bg-hive-surface/40">
      {/* Avatar */}
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
        style={{ backgroundColor: isAgent ? accent : "#373e47" }}
      >
        {initials(name ?? "?")}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-hive-text">{name}</span>
          {isAgent && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              AI · {message.agentRole ?? agent?.role}
            </span>
          )}
          <span className="text-[11px] text-hive-muted">
            {formatTime(message.createdAt)}
          </span>
          {isAgent && (agent?.model || message.metadata?.model) && (
            <span className="text-[11px] text-hive-muted/70">
              {message.metadata?.model ?? agent?.model}
            </span>
          )}
        </div>
        <p
          className={cn(
            "mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-hive-text/90",
          )}
        >
          {renderWithMentions(message.content)}
        </p>
      </div>
    </div>
  );
}

/** Highlight @mentions inline. */
function renderWithMentions(content: string) {
  const parts = content.split(/(@[a-zA-Z0-9_-]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span
        key={i}
        className="rounded bg-hive-accent-soft px-1 font-medium text-hive-accent"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
