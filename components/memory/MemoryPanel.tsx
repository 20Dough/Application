"use client";

import { useCallback, useEffect, useState } from "react";
import { canManageMemory } from "@/lib/roles";
import { MemoryCard, type MemorySummary } from "@/components/memory/MemoryCard";
import {
  MemoryForm,
  type MemoryFormValues,
  type RoomOption,
} from "@/components/memory/MemoryForm";

// MemoryPanel — stateful container for a workspace's shared memory.
//
// Fetches the memory items (any member may view) and the room list (to scope
// items and resolve room names). For owners/admins it owns create / edit /
// delete. The API enforces every permission and validation rule; this component
// mirrors the permission check only to shape the UI.

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: MemorySummary };

export function MemoryPanel({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<MemorySummary[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = canManageMemory(role);
  const roomName = (roomId: string | null) =>
    roomId ? rooms.find((r) => r.id === roomId)?.name ?? null : null;

  const refresh = useCallback(async () => {
    try {
      // Rooms power the scope selector and room-name labels; a failure there is
      // non-fatal (memory still lists, scopes just show "Unknown").
      const [memRes, roomRes] = await Promise.all([
        fetch(`/api/memory?workspaceId=${workspaceId}`),
        fetch(`/api/rooms?workspaceId=${workspaceId}`),
      ]);
      if (!memRes.ok) {
        const data = await memRes.json().catch(() => null);
        throw new Error(data?.error || "Failed to load memory");
      }
      const memData = await memRes.json();
      setItems(memData.memoryItems ?? []);
      setRole(memData.role ?? "viewer");
      if (roomRes.ok) {
        const roomData = await roomRes.json();
        setRooms(
          (roomData.rooms ?? []).map((r: { id: string; name: string }) => ({
            id: r.id,
            name: r.name,
          }))
        );
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(values: MemoryFormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      const editing = form.mode === "edit" ? form.item : null;
      const res = await fetch(
        editing ? `/api/memory/${editing.id}` : "/api/memory",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing ? values : { ...values, workspaceId }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save memory");
      }
      setForm({ mode: "closed" });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(item: MemorySummary) {
    if (!confirm(`Delete "${item.title}" from memory?`)) return;
    setBusyId(item.id);
    setActionError(null);
    (async () => {
      try {
        const res = await fetch(`/api/memory/${item.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to delete");
        }
        await refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to delete");
      } finally {
        setBusyId(null);
      }
    })();
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading memory…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {canManage && form.mode === "closed" && (
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setForm({ mode: "create" });
          }}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
        >
          + Add memory
        </button>
      )}

      {actionError && (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      )}

      {canManage && form.mode !== "closed" && (
        <MemoryForm
          item={form.mode === "edit" ? form.item : undefined}
          rooms={rooms}
          submitting={submitting}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => {
            setForm({ mode: "closed" });
            setFormError(null);
          }}
        />
      )}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No shared memory yet.
          {canManage
            ? " Add the facts your AI teammates should always keep in mind."
            : ""}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <MemoryCard
              key={item.id}
              item={item}
              roomName={roomName(item.roomId)}
              canManage={canManage}
              busy={busyId === item.id}
              onEdit={(i) => {
                setFormError(null);
                setForm({ mode: "edit", item: i });
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
