import { describe, it, expect } from "vitest";
import { POST, GET } from "@/app/api/messages/route";
import { db } from "@/lib/db";
import {
  createWorkspaceFixture,
  createUser,
  addMember,
  loginAs,
  jsonRequest,
  readJson,
} from "@/test/factories";

describe("POST /api/messages", () => {
  it("requires authentication", async () => {
    const { room } = await createWorkspaceFixture();
    const res = await POST(
      jsonRequest("http://t/api/messages", {
        method: "POST",
        body: { roomId: room.id, content: "hi @ARi" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("runs the full loop: saves the human message + a mentioned agent's reply + usage", async () => {
    const { owner, room, ari } = await createWorkspaceFixture();
    await loginAs(owner.id);

    const res = await POST(
      jsonRequest("http://t/api/messages", {
        method: "POST",
        body: { roomId: room.id, content: "Please review this @ARi" },
      }),
    );
    const body = await readJson(res);

    expect(body.status).toBe(201);
    expect(body.data.humanMessage.content).toBe("Please review this @ARi");
    expect(body.data.agentMessages).toHaveLength(1);
    expect(body.data.agentMessages[0].senderType).toBe("agent");
    expect(body.data.agentMessages[0].agentId).toBe(ari.id);

    // Usage was logged for the responding model.
    expect(await db.usageLog.count()).toBeGreaterThanOrEqual(1);
  });

  it("forbids viewers from sending", async () => {
    const { workspace, room } = await createWorkspaceFixture();
    const viewer = await addMember(workspace.id, "viewer");
    await loginAs(viewer.id);

    const res = await POST(
      jsonRequest("http://t/api/messages", {
        method: "POST",
        body: { roomId: room.id, content: "hi @ARi" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("gates a locked room on the passcode header", async () => {
    const { owner, room } = await createWorkspaceFixture({
      passcode: "sesame",
    });
    await loginAs(owner.id);

    const blocked = await POST(
      jsonRequest("http://t/api/messages", {
        method: "POST",
        body: { roomId: room.id, content: "hi @ARi" },
      }),
    );
    expect(blocked.status).toBe(403);

    const allowed = await POST(
      jsonRequest("http://t/api/messages", {
        method: "POST",
        body: { roomId: room.id, content: "hi @ARi" },
        headers: { "x-room-passcode": "sesame" },
      }),
    );
    expect(allowed.status).toBe(201);
  });
});

describe("GET /api/messages", () => {
  it("returns the room's messages for a member", async () => {
    const { owner, room } = await createWorkspaceFixture();
    await loginAs(owner.id);
    await POST(
      jsonRequest("http://t/api/messages", {
        method: "POST",
        body: { roomId: room.id, content: "first @ARi" },
      }),
    );

    const res = await GET(
      jsonRequest(`http://t/api/messages?roomId=${room.id}`),
    );
    const body = await readJson(res);
    expect(body.status).toBe(200);
    expect(body.data.length).toBeGreaterThanOrEqual(2); // human + agent
  });

  it("blocks non-members", async () => {
    const { room } = await createWorkspaceFixture();
    const outsider = await createUser();
    await loginAs(outsider.id);

    const res = await GET(
      jsonRequest(`http://t/api/messages?roomId=${room.id}`),
    );
    expect(res.status).toBe(403);
  });
});
