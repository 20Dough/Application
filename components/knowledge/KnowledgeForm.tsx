"use client";

import { useState } from "react";
import { SOURCE_TYPES, type SourceType } from "@/lib/knowledge/validation";
import type { KnowledgeSummary } from "@/components/knowledge/KnowledgeCard";

// KnowledgeForm — add a new knowledge source, or edit an existing source's
// metadata. On create the user provides title, type, content (typed/pasted or
// loaded from a .txt/.md file), and scope. On edit, content and type are fixed
// (changing them would require re-ingestion); only title and scope are editable.

export type KnowledgeCreateValues = {
  title: string;
  content: string;
  sourceType: SourceType;
  roomId: string;
};

export type KnowledgeEditValues = {
  title: string;
  roomId: string;
};

export type RoomOption = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500";
const labelClass = "mb-1 block text-sm text-neutral-300";

// Plain-text formats we can read directly in the browser. Binary documents
// (PDF/DOCX) need server-side parsing — out of scope for the MVP, which ingests
// text/markdown the user provides.
const TEXT_FILE_ACCEPT = ".txt,.md,.markdown,.text,text/plain";

export function KnowledgeForm({
  item,
  rooms,
  submitting,
  error,
  onCreate,
  onEdit,
  onCancel,
}: {
  /** When provided, the form edits this source's metadata; otherwise it creates one. */
  item?: KnowledgeSummary;
  rooms: RoomOption[];
  submitting: boolean;
  error: string | null;
  onCreate: (values: KnowledgeCreateValues) => void;
  onEdit: (values: KnowledgeEditValues) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(item);
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>(
    (item?.sourceType as SourceType) ?? "text"
  );
  const [roomId, setRoomId] = useState(item?.roomId ?? "");
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    try {
      const text = await file.text();
      setContent(text);
      // Default the title to the file name (without extension) if still blank.
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }
      setSourceType("document");
    } catch {
      setFileError("Could not read that file.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (isEdit) {
      onEdit({ title: title.trim(), roomId });
    } else {
      onCreate({ title: title.trim(), content, sourceType, roomId });
    }
  }

  const canSubmit = isEdit
    ? Boolean(title.trim())
    : Boolean(title.trim() && content.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="font-semibold">
        {isEdit ? "Edit knowledge source" : "Add knowledge"}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {isEdit
          ? "Update the title or scope. Content is fixed once ingested — delete and re-add to change it."
          : "Add a document or block of text. It's split into chunks and embedded so your AI teammates can retrieve the relevant parts when answering."}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="kn-title" className={labelClass}>
            Title
          </label>
          <input
            id="kn-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. API spec, Onboarding guide, Meeting notes"
            required
            className={inputClass}
          />
        </div>

        {!isEdit && (
          <>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="kn-content" className={labelClass}>
                  Content
                </label>
                <label className="cursor-pointer text-xs text-neutral-400 underline hover:text-neutral-200">
                  Load from file
                  <input
                    type="file"
                    accept={TEXT_FILE_ACCEPT}
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </label>
              </div>
              <textarea
                id="kn-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste or type the document/text to ingest."
                rows={8}
                required
                className={`${inputClass} resize-y`}
              />
              {fileError && (
                <p className="mt-1 text-xs text-red-400">{fileError}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="kn-type" className={labelClass}>
                  Type
                </label>
                <select
                  id="kn-type"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as SourceType)}
                  className={inputClass}
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t === "document" ? "Document" : "Text"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="kn-room" className={labelClass}>
                  Scope
                </label>
                <select
                  id="kn-room"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Workspace-wide</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room: {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {isEdit && (
          <div>
            <label htmlFor="kn-room-edit" className={labelClass}>
              Scope
            </label>
            <select
              id="kn-room-edit"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={inputClass}
            >
              <option value="">Workspace-wide</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room: {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add knowledge"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
