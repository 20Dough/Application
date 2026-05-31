"use client";

// KnowledgeCard — presentational summary of one knowledge source.
//
// Shows title, type, scope, and ingestion stats (chunks / characters). Chunk
// text itself is internal to retrieval and never shown here. Management actions
// render only when the viewer can manage knowledge; callbacks are owned by the
// parent panel.

export type KnowledgeSummary = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  charCount: number;
  chunkCount: number;
  roomId: string | null;
  createdAt: string;
};

function typeLabel(sourceType: string): string {
  return sourceType === "document" ? "Document" : "Text";
}

export function KnowledgeCard({
  item,
  roomName,
  canManage,
  busy,
  onEdit,
  onDelete,
}: {
  item: KnowledgeSummary;
  /** Resolved room name when the source is room-scoped; null for workspace-wide. */
  roomName: string | null;
  canManage: boolean;
  busy: boolean;
  onEdit: (item: KnowledgeSummary) => void;
  onDelete: (item: KnowledgeSummary) => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 font-semibold text-neutral-100">
          {item.title}
        </h3>
        <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
          {typeLabel(item.sourceType)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        <span>
          {item.chunkCount} chunk{item.chunkCount === 1 ? "" : "s"}
        </span>
        <span aria-hidden>·</span>
        <span>{item.charCount.toLocaleString()} chars</span>
        <span aria-hidden>·</span>
        <span>{item.roomId ? `Room: ${roomName ?? "Unknown"}` : "Workspace-wide"}</span>
        {item.status !== "ready" && (
          <>
            <span aria-hidden>·</span>
            <span className="text-amber-400">{item.status}</span>
          </>
        )}
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
