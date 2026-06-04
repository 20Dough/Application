import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/room-agents/route";
import {
  createWorkspaceFixture,
  loginAs,
  jsonRequest,
  readJson,
} from "@/test/factories";

describe("GET /api/room-agents passcode gating", () => {
  it("lists a room's agents for an open room", async () => {
    const { owner, room } = await createWorkspaceFixture();
    await loginAs(owner.id);
    const res = await readJson(
      await GET(jsonRequest(`http://t/api/room-agents?roomId=${room.id}`)),
    );
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(2); // ARi + Cloudy
  });

  it("blocks a locked room without the passcode, allows it with", async () => {
    const { owner, room } = await createWorkspaceFixture({
      passcode: "sesame",
    });
    await loginAs(owner.id);

    const blocked = await GET(
      jsonRequest(`http://t/api/room-agents?roomId=${room.id}`),
    );
    expect(blocked.status).toBe(403);

    const allowed = await GET(
      jsonRequest(`http://t/api/room-agents?roomId=${room.id}`, {
        headers: { "x-room-passcode": "sesame" },
      }),
    );
    expect(allowed.status).toBe(200);
  });
});
