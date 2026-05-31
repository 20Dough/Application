"use client";

import { useCallback, useEffect, useState } from "react";
import { canManageKnowledge } from "@/lib/roles";
import {
  KnowledgeCard,
  type KnowledgeSummary,
} from "@/components/knowledge/KnowledgeCard";
import {
  KnowledgeForm,
  type KnowledgeCreateValues,
  type KnowledgeEditValues,
  type RoomOption,
} from "@/components/knowledge/KnowledgeForm";
import { KnowledgeSearch } from "@/components/knowledge/KnowledgeSearch";

// KnowledgePanel — stateful container for a workspace's knowledge base.
//
// Fetches the sources (any member may view) and the room list (to scope sources
// and resolve room names). For owners/admins it owns add / edit / delete. The API
// enforces every permission and validation rule; this component mirrors the
// permission check only to shape the UI. A retrieval-preview search lets anyone
// see what the AI would find for a question.

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: KnowledgeSummary };

export function KnowledgePanel({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<KnowledgeSummary[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = canManageKnowledge(role);
  const roomName = (roomId: string | null) =>
    roomId ? rooms.find((r) => r.id === roomId)?.name ?? null : null;

  const refresh = useCallback(async () => {
    try {
      const [knRes, roomRes] = await Promise.all([
        fetch(`/api/knowledge?workspaceId=${workspaceId}`),
        fetch(`/api/rooms?workspaceId=${workspaceId}`),
      ]);
      if (!knRes.ok) {
        const data = await knRes.json().catch(() => null);
        throw new Error(data?.error || "Failed to load knowledge");
      }
      const knData = await knRes.json();
      setItems(knData.sources ?? []);
      setRole(knData.role ?? "viewer");
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
      setError(err instanceof Error ? err.message : "Failed to load knowledge");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(values: KnowledgeCreateValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, workspaceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to add knowledge");
      }
      setForm({ mode: "closed" });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add knowledge");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(values: KnowledgeEditValues) {
    if (form.mode !== "edit") return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/knowledge/${form.item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save changes");
      }
      setForm({ mode: "closed" });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(item: KnowledgeSummary) {
    if (!confirm(`Delete "${item.title}" from the knowledge base?`)) return;
    setBusyId(item.id);
    setActionError(null);
    (async () => {
      try {
        const res = await fetch(`/api/knowledge/${item.id}`, { method: "DELETE" });
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
    return <p className="text-sm text-neutral-500">Loading knowledge…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-6">
      {items.length > 0 && <KnowledgeSearch workspaceId={workspaceId} />}

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
            + Add knowledge
          </button>
        )}

        {actionError && (
          <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {actionError}
          </p>
        )}

        {canManage && form.mode !== "closed" && (
          <KnowledgeForm
            item={form.mode === "edit" ? form.item : undefined}
            rooms={rooms}
            submitting={submitting}
            error={formError}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onCancel={() => {
              setForm({ mode: "closed" });
              setFormError(null);
            }}
          />
        )}

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
            No knowledge yet.
            {canManage
              ? " Add documents or text your AI teammates can draw on when answering."
              : ""}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <KnowledgeCard
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
    </div>
  );
}
