import { describe, it, expect } from "vitest";
import { generateDecisionSummary } from "@/lib/summary/decision-summary";
import { db } from "@/lib/db";
import { createWorkspaceFixture } from "@/test/factories";

async function seedMessages(
  roomId: string,
  ownerId: string,
  ages: number[], // hours ago
) {
  for (const hoursAgo of ages) {
    await db.message.create({
      data: {
        roomId,
        senderType: "human",
        userId: ownerId,
        content: `message from ${hoursAgo}h ago`,
        createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
      },
    });
  }
}

describe("generateDecisionSummary ranges", () => {
  it("limits the time window for the 2h range", async () => {
    const { workspace, room, owner } = await createWorkspaceFixture();
    // 3 recent (within 2h) + 2 old (>2h)
    await seedMessages(room.id, owner.id, [0.5, 1, 1.5, 5, 10]);

    const d = await generateDecisionSummary({
      workspaceId: workspace.id,
      roomId: room.id,
      range: "2h",
    });
    expect(d.summary).toContain("Messages reviewed: 3");
    expect(d.summary).toContain("Past 2 hours");
  });

  it("includes the whole history for the project range", async () => {
    const { workspace, room, owner } = await createWorkspaceFixture();
    await seedMessages(room.id, owner.id, [0.5, 5, 50]);

    const d = await generateDecisionSummary({
      workspaceId: workspace.id,
      roomId: room.id,
      range: "project",
    });
    expect(d.summary).toContain("Messages reviewed: 3");
  });

  it("caps the recent30 range at 30 messages", async () => {
    const { workspace, room, owner } = await createWorkspaceFixture();
    await seedMessages(
      room.id,
      owner.id,
      Array.from({ length: 35 }, (_, i) => i), // 35 messages, 0..34h ago
    );

    const d = await generateDecisionSummary({
      workspaceId: workspace.id,
      roomId: room.id,
      range: "recent30",
    });
    expect(d.summary).toContain("Messages reviewed: 30");
  });
});
