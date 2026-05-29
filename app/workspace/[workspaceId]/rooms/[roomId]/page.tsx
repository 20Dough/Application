"use client";

import { use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoomDetail } from "@/components/rooms/RoomDetail";

// Room detail page — shows a room's AI agents and human members, and (for
// owners/admins) lets them add/remove agents and set the default agent. All
// access and mutation rules are enforced by the API.

export default function RoomPage({
  params,
}: {
  params: Promise<{ workspaceId: string; roomId: string }>;
}) {
  const { workspaceId, roomId } = use(params);

  return (
    <AppShell subtitle="Room">
      <RoomDetail workspaceId={workspaceId} roomId={roomId} />
    </AppShell>
  );
}
