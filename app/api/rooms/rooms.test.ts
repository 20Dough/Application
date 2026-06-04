import { describe, it, expect } from "vitest";
import { PATCH } from "@/app/api/rooms/[roomId]/route";
import { POST as verify } from "@/app/api/rooms/[roomId]/verify/route";
import { db } from "@/lib/db";
import {
  createWorkspaceFixture,
  addMember,
  loginAs,
  jsonRequest,
  readJson,
} from "@/test/factories";

const params = (roomId: string) => ({ params: Promise.resolve({ roomId }) });

describe("room passcode management", () => {
  it("lets the room creator set a passcode", async () => {
    const { owner, room } = await createWorkspaceFixture();
    await loginAs(owner.id);

    const res = await PATCH(
      jsonRequest(`http://t/api/rooms/${room.id}`, {
        method: "PATCH",
        body: { passcode: "letmein" },
      }),
      params(room.id),
    );
    const body = await readJson(res);
    expect(body.status).toBe(200);
    expect(body.data.isLocked).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/passcodeHash|letmein/);

    const row = await db.room.findUnique({ where: { id: room.id } });
    expect(row?.passcodeHash).toBeTruthy();
  });

  it("forbids a non-creator admin from setting the passcode", async () => {
    const { workspace, room } = await createWorkspaceFixture();
    const admin = await addMember(workspace.id, "admin");
    await loginAs(admin.id);

    const res = await PATCH(
      jsonRequest(`http://t/api/rooms/${room.id}`, {
        method: "PATCH",
        body: { passcode: "hijack" },
      }),
      params(room.id),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/rooms/[roomId]/verify", () => {
  it("accepts the correct passcode and rejects a wrong one", async () => {
    const { owner, room } = await createWorkspaceFixture({ passcode: "p4ss" });
    await loginAs(owner.id);

    const wrong = await verify(
      jsonRequest(`http://t/api/rooms/${room.id}/verify`, {
        method: "POST",
        body: { passcode: "nope" },
      }),
      params(room.id),
    );
    expect(wrong.status).toBe(403);

    const right = await readJson(
      await verify(
        jsonRequest(`http://t/api/rooms/${room.id}/verify`, {
          method: "POST",
          body: { passcode: "p4ss" },
        }),
        params(room.id),
      ),
    );
    expect(right.status).toBe(200);
    expect(right.data.unlocked).toBe(true);
  });
});
