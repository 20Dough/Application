"use client";

import { useCallback, useEffect, useState } from "react";
import { canManageRooms } from "@/lib/roles";
import { RoomCard, type RoomSummary } from "@/components/rooms/RoomCard";
import { CreateRoomForm } from "@/components/rooms/CreateRoomForm";

// RoomsPanel — stateful container for a workspace's room list.
//
// Fetches the rooms (any member may view) and, for owners/admins, owns the
// create and delete actions. The API enforces every permission and validation
// rule; this component mirrors the permission check only to shape the UI.

export function RoomsPanel({ workspaceId }: { workspaceId: string }) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = canManageRooms(role);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms?workspaceId=${workspaceId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load rooms");
      }
      const data = await res.json();
      setRooms(data.rooms ?? []);
      setRole(data.role ?? "viewer");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleDelete(room: RoomSummary) {
    if (!confirm(`Delete "${room.name}"? This removes the room for everyone.`)) {
      return;
    }
    setBusyId(room.id);
    setActionError(null);
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to delete room");
        }
        await refresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to delete room"
        );
      } finally {
        setBusyId(null);
      }
    })();
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading rooms…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <section className="space-y-4">
        {actionError && (
          <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {actionError}
          </p>
        )}

        {rooms.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
            No rooms yet.
            {canManage
              ? " Create one to get your team working together."
              : ""}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                canManage={canManage}
                busy={busyId === room.id}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <aside>
          <CreateRoomForm workspaceId={workspaceId} onCreated={refresh} />
        </aside>
      )}
    </div>
  );
}
