"use client";

import { useRef, useState } from "react";
import type { Agent, Attachment } from "@/types";

interface MessageInputProps {
  roomName: string;
  agents: Agent[];
  disabled?: boolean;
  onSend: (content: string, attachmentIds: string[]) => void;
  onUploadFile: (file: File) => Promise<Attachment>;
}

export function MessageInput({
  roomName,
  agents,
  disabled,
  onSend,
  onUploadFile,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend(
      trimmed || "(see attached file)",
      attachments.map((a) => a.id),
    );
    setValue("");
    setAttachments([]);
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

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const att = await onUploadFile(file);
        setAttachments((prev) => [...prev, att]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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

      {/* Pending attachments */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="flex items-center gap-1 rounded-md border border-hive-border bg-hive-panel px-2 py-0.5 text-xs text-hive-text"
            >
              📎 {a.name}
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                }
                className="text-hive-muted hover:text-red-400"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-lg border border-hive-border bg-hive-panel px-3 py-2 focus-within:border-hive-accent">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          title="Attach a file (PDF, Word, Excel, text)"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="pb-0.5 text-lg text-hive-muted transition hover:text-hive-accent disabled:opacity-40"
        >
          📎
        </button>
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
          disabled={(!value.trim() && attachments.length === 0) || disabled}
          className="rounded-md bg-hive-accent px-3 py-1.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="mt-1 px-1 text-[11px] text-hive-muted">
        {uploading
          ? "Uploading & reading file…"
          : "Enter to send · Shift+Enter for a new line · 📎 to attach a document"}
      </p>
    </div>
  );
}
