"use client";

import { useCallback, useEffect, useState } from "react";
import { canManageAgents } from "@/lib/roles";
import { AgentCard, type AgentSummary } from "@/components/agents/AgentCard";
import { AgentForm, type AgentFormValues } from "@/components/agents/AgentForm";

// AgentsPanel — stateful container for managing a workspace's AI agents.
//
// Fetches the agent roster (any member may view) and, for owners/admins, owns
// all mutating actions: create, edit, activate/deactivate, delete, and
// restoring the default team. The API enforces every permission and validation
// rule; this component mirrors the permission check only to shape the UI.

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; agent: AgentSummary };

export function AgentsPanel({ workspaceId }: { workspaceId: string }) {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = canManageAgents(role);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents?workspaceId=${workspaceId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load agents");
      }
      const data = await res.json();
      setAgents(data.agents ?? []);
      setRole(data.role ?? "viewer");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runAction(id: string, fn: () => Promise<Response>) {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Action failed");
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSubmit(values: AgentFormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      const editing = form.mode === "edit" ? form.agent : null;
      const res = await fetch(
        editing ? `/api/agents/${editing.id}` : "/api/agents",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing ? values : { ...values, workspaceId }
          ),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save agent");
      }
      setForm({ mode: "closed" });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSubmitting(false);
    }
  }

  function handleToggleActive(agent: AgentSummary) {
    runAction(agent.id, () =>
      fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      })
    );
  }

  function handleDelete(agent: AgentSummary) {
    if (
      !confirm(
        `Delete ${agent.displayName}? This removes the agent from the workspace.`
      )
    ) {
      return;
    }
    runAction(agent.id, () =>
      fetch(`/api/agents/${agent.id}`, { method: "DELETE" })
    );
  }

  function handleSeedDefaults() {
    runAction("seed", () =>
      fetch("/api/agents/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      })
    );
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading agents…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {form.mode === "closed" && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setForm({ mode: "create" });
              }}
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
            >
              + Add agent
            </button>
          )}
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={busyId === "seed"}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
          >
            {busyId === "seed" ? "Restoring…" : "Restore default team"}
          </button>
        </div>
      )}

      {actionError && (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      )}

      {canManage && form.mode !== "closed" && (
        <AgentForm
          agent={form.mode === "edit" ? form.agent : undefined}
          submitting={submitting}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => {
            setForm({ mode: "closed" });
            setFormError(null);
          }}
        />
      )}

      {agents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No AI agents yet.
          {canManage
            ? " Add one above, or restore the default team (ARi & Cloudy)."
            : ""}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              canManage={canManage}
              busy={busyId === agent.id}
              onEdit={(a) => {
                setFormError(null);
                setForm({ mode: "edit", agent: a });
              }}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
