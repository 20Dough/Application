"use client";

import { useCallback, useEffect, useState } from "react";
import { canManageProjectContext } from "@/lib/roles";
import {
  ProjectContextCard,
  type ProjectContextSummary,
} from "@/components/memory/ProjectContextCard";
import {
  ProjectContextForm,
  type ProjectContextFormValues,
} from "@/components/memory/ProjectContextForm";

// ProjectContextPanel — stateful container for a workspace's project context.
//
// Fetches the entries (any member may view) and, for owners/admins, owns the
// create / edit / delete actions. The API enforces every permission and
// validation rule; this component mirrors the permission check only to shape
// the UI.

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; entry: ProjectContextSummary };

export function ProjectContextPanel({ workspaceId }: { workspaceId: string }) {
  const [entries, setEntries] = useState<ProjectContextSummary[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = canManageProjectContext(role);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/project-context?workspaceId=${workspaceId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load project context");
      }
      const data = await res.json();
      setEntries(data.projectContexts ?? []);
      setRole(data.role ?? "viewer");
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load project context"
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(values: ProjectContextFormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      const editing = form.mode === "edit" ? form.entry : null;
      const res = await fetch(
        editing ? `/api/project-context/${editing.id}` : "/api/project-context",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing ? values : { ...values, workspaceId }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save project context");
      }
      setForm({ mode: "closed" });
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save project context"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(entry: ProjectContextSummary) {
    if (!confirm(`Delete "${entry.title}" from project context?`)) return;
    setBusyId(entry.id);
    setActionError(null);
    (async () => {
      try {
        const res = await fetch(`/api/project-context/${entry.id}`, {
          method: "DELETE",
        });
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
    return <p className="text-sm text-neutral-500">Loading project context…</p>;
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
          + Add project context
        </button>
      )}

      {actionError && (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      )}

      {canManage && form.mode !== "closed" && (
        <ProjectContextForm
          entry={form.mode === "edit" ? form.entry : undefined}
          submitting={submitting}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => {
            setForm({ mode: "closed" });
            setFormError(null);
          }}
        />
      )}

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No project context yet.
          {canManage
            ? " Add your mission and non-negotiables so every AI teammate stays on track."
            : ""}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <ProjectContextCard
              key={entry.id}
              entry={entry}
              canManage={canManage}
              busy={busyId === entry.id}
              onEdit={(e) => {
                setFormError(null);
                setForm({ mode: "edit", entry: e });
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
