"use client";

// DecisionCard — presentational summary of one decision.
//
// Shows the title, the summary, any action items, the room it came from (or
// "Workspace-wide"), and when it was generated. Purely presentational; the
// parent panel owns data loading and the generate flow.

export type DecisionSummary = {
  id: string;
  roomId: string | null;
  title: string;
  summary: string;
  actionItems: string[];
  createdAt: string;
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DecisionCard({
  decision,
  roomName,
}: {
  decision: DecisionSummary;
  /** Resolved room name when the decision is room-scoped; null otherwise. */
  roomName: string | null;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 font-semibold text-neutral-100">
          {decision.title}
        </h3>
        <span className="shrink-0 text-[11px] text-neutral-600">
          {formatDate(decision.createdAt)}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-400">
        {decision.summary}
      </p>

      {decision.actionItems.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">
            Action items
          </p>
          <ul className="mt-1.5 space-y-1">
            {decision.actionItems.map((item, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-neutral-300"
              >
                <span aria-hidden className="text-neutral-600">
                  ▸
                </span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
        {decision.roomId ? `Room: ${roomName ?? "Unknown"}` : "Workspace-wide"}
      </div>
    </div>
  );
}
