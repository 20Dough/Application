// Decision summary generator (Phase 10).
//
// Generates a decision summary from recent room messages. For the MVP this uses
// a deterministic heuristic so it works with no AI keys; it can later route
// through an agent/provider for a richer summary.

import { db } from "@/lib/db";

interface GenerateSummaryArgs {
  workspaceId: string;
  roomId: string;
  title?: string;
}

export async function generateDecisionSummary({
  workspaceId,
  roomId,
  title,
}: GenerateSummaryArgs) {
  const messages = await db.message.findMany({
    where: { roomId, senderType: { in: ["human", "agent"] } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: true, agent: true },
  });

  const room = await db.room.findUnique({ where: { id: roomId } });
  const ordered = [...messages].reverse();

  const topic = title ?? `Discussion in ${room?.name ?? "room"}`;
  const participantNames = [
    ...new Set(
      ordered.map((m) => m.user?.name ?? m.agent?.displayName ?? "Unknown"),
    ),
  ];

  const summaryLines = [
    `Topic: ${topic}`,
    `Participants: ${participantNames.join(", ") || "—"}`,
    `Messages reviewed: ${ordered.length}`,
    "",
    "Key points:",
    ...ordered.slice(-5).map((m) => {
      const who = m.user?.name ?? m.agent?.displayName ?? "System";
      return `- ${who}: ${m.content.slice(0, 120)}`;
    }),
  ];

  // Naive action-item extraction: lines that look like tasks.
  const actionItems = ordered
    .filter((m) =>
      /\b(todo|action|next step|should|let's|need to)\b/i.test(m.content),
    )
    .slice(-5)
    .map((m) => m.content.slice(0, 120));

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
