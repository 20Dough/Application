"use client";

import { useState } from "react";
import {
  MIN_IMPORTANCE,
  MAX_IMPORTANCE,
  DEFAULT_IMPORTANCE,
} from "@/lib/memory/validation";
import type { MemorySummary } from "@/components/memory/MemoryCard";

// MemoryForm — reusable create/edit form for a shared memory item.
//
// Importance is a bounded select (0–5); a memory item may be workspace-wide or
// scoped to a single room (chosen from the rooms passed in by the panel).

export type MemoryFormValues = {
  title: string;
  content: string;
  importance: number;
  roomId: string;
};

export type RoomOption = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500";
const labelClass = "mb-1 block text-sm text-neutral-300";

const IMPORTANCE_LEVELS = Array.from(
  { length: MAX_IMPORTANCE - MIN_IMPORTANCE + 1 },
  (_, i) => MIN_IMPORTANCE + i
);

export function MemoryForm({
  item,
  rooms,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  /** When provided, the form edits this item; otherwise it creates a new one. */
  item?: MemorySummary;
  rooms: RoomOption[];
  submitting: boolean;
  error: string | null;
  onSubmit: (values: MemoryFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(item);
  const [values, setValues] = useState<MemoryFormValues>({
    title: item?.title ?? "",
    content: item?.content ?? "",
    importance: item?.importance ?? DEFAULT_IMPORTANCE,
    roomId: item?.roomId ?? "",
  });

  function set<K extends keyof MemoryFormValues>(
    key: K,
    value: MemoryFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    onSubmit(values);
  }

  const canSubmit = values.title.trim() && values.content.trim();

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="font-semibold">
        {isEdit ? "Edit memory" : "Add memory"}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Curated facts the AI team should remember — constraints, preferences,
        decisions of record. Higher importance is kept first when context is
        tight.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="mem-title" className={labelClass}>
            Title
          </label>
          <input
            id="mem-title"
            type="text"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Brand voice, Tech constraint, Key deadline"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="mem-content" className={labelClass}>
            Content
          </label>
          <textarea
            id="mem-content"
            value={values.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="The fact the AI team should keep in mind."
            rows={4}
            required
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mem-importance" className={labelClass}>
              Importance
            </label>
            <select
              id="mem-importance"
              value={values.importance}
              onChange={(e) => set("importance", Number(e.target.value))}
              className={inputClass}
            >
              {IMPORTANCE_LEVELS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mem-room" className={labelClass}>
              Scope
            </label>
            <select
              id="mem-room"
              value={values.roomId}
              onChange={(e) => set("roomId", e.target.value)}
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
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add memory"}
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
