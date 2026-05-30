"use client";

import { MAX_IMPORTANCE } from "@/lib/memory/validation";

// MemoryCard — presentational summary of one shared memory item.
//
// Shows title, content, an importance indicator, and (when room-scoped) the
// room it belongs to. Management actions render only when the viewer can manage
// memory; callbacks are owned by the parent panel.

export type MemorySummary = {
  id: string;
  title: string;
  content: string;
  importance: number;
  roomId: string | null;
};

function importanceLabel(value: number): string {
  if (value >= 5) return "Critical";
  if (value >= 4) return "High";
  if (value >= 2) return "Medium";
  if (value >= 1) return "Normal";
  return "Background";
}

export function MemoryCard({
  item,
  roomName,
  canManage,
  busy,
  onEdit,
  onDelete,
}: {
  item: MemorySummary;
  /** Resolved room name when the item is room-scoped; null for workspace-wide. */
  roomName: string | null;
  canManage: boolean;
  busy: boolean;
  onEdit: (item: MemorySummary) => void;
  onDelete: (item: MemorySummary) => void;
}) {
  const filled = Math.min(MAX_IMPORTANCE, Math.max(0, item.importance));

  return (
    <div className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 font-semibold text-neutral-100">
          {item.title}
        </h3>
        <span
          title={`Importance: ${item.importance}/${MAX_IMPORTANCE}`}
          className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400"
        >
          {importanceLabel(item.importance)}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-400">
        {item.content}
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
        <span aria-hidden>{"●".repeat(filled)}{"○".repeat(MAX_IMPORTANCE - filled)}</span>
        <span>
          {item.roomId ? `Room: ${roomName ?? "Unknown"}` : "Workspace-wide"}
        </span>
      </div>

      {canManage && (
        <div className="mt-4 flex items-center gap-2 border-t border-neutral-800 pt-4">
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={busy}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={busy}
            className="ml-auto rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-red-700/60 hover:text-red-300 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
