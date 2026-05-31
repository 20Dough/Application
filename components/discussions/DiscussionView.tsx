"use client";

import Link from "next/link";
import type { DiscussionDetail, DiscussionTurn } from "@/components/discussions/types";

// DiscussionView — the full detail of one discussion: the turns grouped by
// round, the synthesized summary, the points of consensus, and the open
// disagreements. When the caller may run discussions it also offers to turn the
// discussion into a Decision (or links to the one already generated).
//
// Purely presentational; the parent panel owns data loading and the
// generate-decision flow.

function groupByRound(turns: DiscussionTurn[]): Map<number, DiscussionTurn[]> {
  const rounds = new Map<number, DiscussionTurn[]>();
  for (const turn of turns) {
    const list = rounds.get(turn.round) ?? [];
    list.push(turn);
    rounds.set(turn.round, list);
  }
  return rounds;
}

export function DiscussionView({
  workspaceId,
  discussion,
  canGenerate,
  generating,
  generateError,
  onGenerateDecision,
}: {
  workspaceId: string;
  discussion: DiscussionDetail;
  canGenerate: boolean;
  generating: boolean;
  generateError: string | null;
  onGenerateDecision: () => void;
}) {
  const rounds = groupByRound(discussion.turns);

  return (
    <div className="space-y-6">
      {/* Synthesis */}
      <section>
        <h3 className="text-xs uppercase tracking-wide text-neutral-500">Summary</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">
          {discussion.summary || "No summary was generated."}
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="text-xs uppercase tracking-wide text-neutral-500">
            Consensus
          </h3>
          {discussion.consensus.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-500">
              No points of consensus were identified.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {discussion.consensus.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-300">
                  <span aria-hidden className="text-emerald-500">
                    ✓
                  </span>
                  <span className="min-w-0">{point}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wide text-neutral-500">
            Disagreements
          </h3>
          {discussion.disagreements.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-500">
              No open disagreements were identified.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {discussion.disagreements.map((d, i) => (
                <li key={i} className="text-sm text-neutral-300">
                  <span className="flex gap-2">
                    <span aria-hidden className="text-amber-500">
                      ⚡
                    </span>
                    <span className="min-w-0">{d.point}</span>
                  </span>
                  {d.positions && (
                    <span className="ml-6 block text-xs text-neutral-500">
                      {d.positions}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Decision */}
      <section className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
        {discussion.decisionId ? (
          <p className="text-sm text-neutral-300">
            <span className="text-emerald-500">✓</span> A decision was generated
            from this discussion.{" "}
            <Link
              href={`/workspace/${workspaceId}/decisions`}
              className="underline hover:text-neutral-100"
            >
              View in Decisions
            </Link>
          </p>
        ) : canGenerate ? (
          <div>
            <p className="text-sm text-neutral-400">
              Turn this discussion into a decision with concrete next steps.
            </p>
            {generateError && (
              <p className="mt-2 text-sm text-red-400">{generateError}</p>
            )}
            <button
              type="button"
              onClick={onGenerateDecision}
              disabled={generating}
              className="mt-3 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? "Generating decision…" : "Generate decision"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            No decision has been generated from this discussion yet.
          </p>
        )}
      </section>

      {/* Transcript */}
      <section>
        <h3 className="text-xs uppercase tracking-wide text-neutral-500">
          Discussion
        </h3>
        <div className="mt-2 space-y-5">
          {[...rounds.entries()].map(([round, turns]) => (
            <div key={round}>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-neutral-600">
                Round {round}
              </p>
              <div className="space-y-3">
                {turns.map((turn) => (
                  <div
                    key={turn.id}
                    className="rounded-md border border-neutral-800 bg-neutral-900 p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-200">
                        {turn.agentName}
                      </span>
                      <span className="text-[11px] text-neutral-600">
                        {turn.provider}/{turn.model}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">
                      {turn.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
