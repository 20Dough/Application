"use client";

import { DiscussionView } from "@/components/discussions/DiscussionView";
import type {
  DiscussionDetail,
  DiscussionListItem,
} from "@/components/discussions/types";

// DiscussionCard — one discussion in the list. Collapsed it shows the topic, a
// summary preview, and counts; expanded it loads and renders the full
// DiscussionView (turns, synthesis, and the decision control). The parent panel
// owns expansion state, detail loading, and the generate-decision flow.

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DiscussionCard({
  workspaceId,
  item,
  roomName,
  expanded,
  detail,
  detailLoading,
  detailError,
  onToggle,
  canGenerate,
  generating,
  generateError,
  onGenerateDecision,
}: {
  workspaceId: string;
  item: DiscussionListItem;
  roomName: string | null;
  expanded: boolean;
  detail: DiscussionDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onToggle: () => void;
  canGenerate: boolean;
  generating: boolean;
  generateError: string | null;
  onGenerateDecision: () => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-5 text-left"
      >
        <div className="min-w-0">
          <h3 className="font-semibold text-neutral-100">{item.topic}</h3>
          {item.summary && (
            <p className="mt-1 line-clamp-2 text-sm text-neutral-400">
              {item.summary}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-500">
            <span>{roomName ? `Room: ${roomName}` : "Room"}</span>
            <span aria-hidden>·</span>
            <span>{item.turnCount} turns</span>
            <span aria-hidden>·</span>
            <span>{item.rounds} rounds</span>
            <span aria-hidden>·</span>
            <span>{item.consensus.length} consensus</span>
            <span aria-hidden>·</span>
            <span>{item.disagreements.length} disagreements</span>
            {item.decisionId && (
              <>
                <span aria-hidden>·</span>
                <span className="text-emerald-500">decision ✓</span>
              </>
            )}
            {item.status === "failed" && (
              <>
                <span aria-hidden>·</span>
                <span className="text-red-400">failed</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-neutral-600">
            {formatDate(item.createdAt)}
          </span>
          <span className="text-neutral-500">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-neutral-800 p-5">
          {detailLoading ? (
            <p className="text-sm text-neutral-500">Loading discussion…</p>
          ) : detailError ? (
            <p className="text-sm text-red-400">{detailError}</p>
          ) : detail ? (
            <DiscussionView
              workspaceId={workspaceId}
              discussion={detail}
              canGenerate={canGenerate}
              generating={generating}
              generateError={generateError}
              onGenerateDecision={onGenerateDecision}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
