"use client";

import { useState } from "react";
import type { ProjectContextSummary } from "@/components/memory/ProjectContextCard";

// ProjectContextForm — reusable create/edit form for a project context entry.

export type ProjectContextFormValues = {
  title: string;
  content: string;
};

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500";
const labelClass = "mb-1 block text-sm text-neutral-300";

export function ProjectContextForm({
  entry,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  /** When provided, the form edits this entry; otherwise it creates a new one. */
  entry?: ProjectContextSummary;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: ProjectContextFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(entry);
  const [values, setValues] = useState<ProjectContextFormValues>({
    title: entry?.title ?? "",
    content: entry?.content ?? "",
  });

  function set<K extends keyof ProjectContextFormValues>(
    key: K,
    value: ProjectContextFormValues[K]
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
        {isEdit ? "Edit project context" : "Add project context"}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Capture the workspace&apos;s identity and mission. This is the
        highest-priority context every AI teammate sees.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="pc-title" className={labelClass}>
            Title
          </label>
          <input
            id="pc-title"
            type="text"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Mission, Product vision, Non-negotiables"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="pc-content" className={labelClass}>
            Content
          </label>
          <textarea
            id="pc-content"
            value={values.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Describe the project identity, goals, and constraints the team should always keep in mind."
            rows={5}
            required
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add context"}
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
