"use client";

// ProjectContextCard — presentational summary of one project context entry.
//
// Project context is the workspace's stable identity and mission; it leads every
// agent's system prompt. Management actions (edit, delete) render only when the
// viewer can manage project context; callbacks are owned by the parent panel.

export type ProjectContextSummary = {
  id: string;
  title: string;
  content: string;
};

export function ProjectContextCard({
  entry,
  canManage,
  busy,
  onEdit,
  onDelete,
}: {
  entry: ProjectContextSummary;
  canManage: boolean;
  busy: boolean;
  onEdit: (entry: ProjectContextSummary) => void;
  onDelete: (entry: ProjectContextSummary) => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-0.5 text-neutral-500">
          ★
        </span>
        <h3 className="min-w-0 flex-1 font-semibold text-neutral-100">
          {entry.title}
        </h3>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-400">
        {entry.content}
      </p>

      {canManage && (
        <div className="mt-4 flex items-center gap-2 border-t border-neutral-800 pt-4">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            disabled={busy}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry)}
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
