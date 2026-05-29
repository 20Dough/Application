"use client";

import { useState } from "react";

// MessageInput — the composer at the bottom of the room chat. A multi-line
// textarea that submits on Enter (Shift+Enter inserts a newline). Disabled for
// read-only viewers, who see an explanatory note instead of the box.

export function MessageInput({
  onSend,
  disabled = false,
  canSend = true,
}: {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  canSend?: boolean;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  if (!canSend) {
    return (
      <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-center text-sm text-neutral-500">
        You have view-only access to this room and cannot send messages.
      </p>
    );
  }

  async function submit() {
    const content = value.trim();
    if (!content || sending || disabled) return;
    setSending(true);
    try {
      await onSend(content);
      setValue("");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Write a message…"
        disabled={disabled || sending}
        aria-label="Message"
        className="max-h-40 min-h-[2.5rem] flex-1 resize-y rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!value.trim() || sending || disabled}
        className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
