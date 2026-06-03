// Decision summary generator (Phase 10).
//
// Generates a decision summary from room messages over a chosen range. For the
// MVP this uses a deterministic heuristic so it works with no AI keys; it can
// later route through an agent/provider for a richer summary.

import { db } from "@/lib/db";

/** How far back to pull messages for a summary. */
export type SummaryRange = "recent30" | "2h" | "1d" | "project";

export const SUMMARY_RANGE_LABELS: Record<SummaryRange, string> = {
  recent30: "Last 30 messages",
  "2h": "Past 2 hours",
  "1d": "Past day",
  project: "Whole project",
};

/** The valid range values, derived from the labels so the two never drift. */
export const SUMMARY_RANGES = Object.keys(
  SUMMARY_RANGE_LABELS,
) as SummaryRange[];

// Heuristic summary tuning.
const RECENT_MESSAGE_LIMIT = 30;
const KEY_POINT_COUNT = 5;
const SNIPPET_LENGTH = 120;

function rangeStart(range: SummaryRange): Date | null {
  const now = Date.now();
  switch (range) {
    case "2h":
      return new Date(now - 2 * 60 * 60 * 1000);
    case "1d":
      return new Date(now - 24 * 60 * 60 * 1000);
    default:
      return null; // recent30 / project have no time floor
  }
}

interface GenerateSummaryArgs {
  workspaceId: string;
  roomId: string;
  title?: string;
  range?: SummaryRange;
}

export async function generateDecisionSummary({
  workspaceId,
  roomId,
  title,
  range = "recent30",
}: GenerateSummaryArgs) {
  const since = rangeStart(range);

  const messages = await db.message.findMany({
    where: {
      roomId,
      senderType: { in: ["human", "agent"] },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    // recent30 caps the count; time/project ranges take everything in range.
    ...(range === "recent30" ? { take: RECENT_MESSAGE_LIMIT } : {}),
    include: { user: true, agent: true },
  });

  const room = await db.room.findUnique({ where: { id: roomId } });
  const ordered = [...messages].reverse();

  const rangeLabel = SUMMARY_RANGE_LABELS[range];
  const topic =
    title ?? `Discussion in ${room?.name ?? "room"} — ${rangeLabel}`;
  const participantNames = [
    ...new Set(
      ordered.map((m) => m.user?.name ?? m.agent?.displayName ?? "Unknown"),
    ),
  ];

  const summaryLines = [
    `Topic: ${topic}`,
    `Range: ${rangeLabel}`,
    `Participants: ${participantNames.join(", ") || "—"}`,
    `Messages reviewed: ${ordered.length}`,
    "",
    "Key points:",
    ...ordered.slice(-KEY_POINT_COUNT).map((m) => {
      const who = m.user?.name ?? m.agent?.displayName ?? "System";
      return `- ${who}: ${m.content.slice(0, SNIPPET_LENGTH)}`;
    }),
  ];

  // Naive action-item extraction: lines that look like tasks.
  const actionItems = ordered
    .filter((m) =>
      /\b(todo|action|next step|should|let's|need to)\b/i.test(m.content),
    )
    .slice(-KEY_POINT_COUNT)
    .map((m) => m.content.slice(0, SNIPPET_LENGTH));

  return db.decision.create({
    data: {
      workspaceId,
      roomId,
      title: topic,
      summary: summaryLines.join("\n"),
      actionItems: JSON.stringify(actionItems),
    },
  });
}
