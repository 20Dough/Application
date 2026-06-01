"use client";

import { useState } from "react";
import type { Agent } from "@/types";

interface MessageInputProps {
  roomName: string;
  agents: Agent[];
  disabled?: boolean;
  onSend: (content: string) => void;
}

export function MessageInput({
  roomName,
  agents,
  disabled,
  onSend,
}: MessageInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function addMention(displayName: string) {
    setValue((v) => (v ? `${v} @${displayName} ` : `@${displayName} `));
  }

  return (
    <div className="border-t border-hive-border bg-hive-surface px-4 py-3">
      {/* Quick mention chips */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {agents
          .filter((a) => a.isActive)
          .map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => addMention(agent.displayName)}
              className="rounded-full border border-hive-border px-2 py-0.5 text-xs text-hive-muted transition hover:border-hive-accent hover:text-hive-accent"
            >
              @{agent.displayName}
            </button>
          ))}
      </div>

      <div className="flex items-end gap-2 rounded-lg border border-hive-border bg-hive-panel px-3 py-2 focus-within:border-hive-accent">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={`Message #${roomName} — mention @ARi or @Cloudy`}
          className="max-h-40 flex-1 resize-none bg-transparent text-sm text-hive-text placeholder:text-hive-muted focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="rounded-md bg-hive-accent px-3 py-1.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="mt-1 px-1 text-[11px] text-hive-muted">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
