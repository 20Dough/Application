"use client";

import { useState } from "react";

interface InlineAddFormProps {
  /** Toggle button label, e.g. "+ Add memory". */
  label: string;
  /** Called with the form values. Return a promise; the form resets on success. */
  onSubmit: (title: string, content: string) => Promise<void>;
  titlePlaceholder?: string;
  contentPlaceholder?: string;
}

/** Collapsible title+content form used to add memory / project context. */
export function InlineAddForm({
  label,
  onSubmit,
  titlePlaceholder = "Title",
  contentPlaceholder = "Content",
}: InlineAddFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit(title.trim(), content.trim());
      setTitle("");
      setContent("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-hive-border px-2.5 py-1.5 text-xs text-hive-muted transition hover:border-hive-accent hover:text-hive-accent"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-hive-border bg-hive-surface p-2.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={titlePlaceholder}
        className="w-full rounded border border-hive-border bg-hive-panel px-2 py-1 text-xs text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={contentPlaceholder}
        rows={2}
        className="w-full resize-none rounded border border-hive-border bg-hive-panel px-2 py-1 text-xs text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-2 py-1 text-xs text-hive-muted transition hover:text-hive-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !title.trim() || !content.trim()}
          className="rounded bg-hive-accent px-2.5 py-1 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
