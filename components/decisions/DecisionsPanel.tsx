"use client";

import { useCallback, useEffect, useState } from "react";
import { canGenerateSummaries } from "@/lib/roles";
import {
  DecisionCard,
  type DecisionSummary,
} from "@/components/decisions/DecisionCard";
import {
  GenerateDecisionForm,
  type GenerateDecisionValues,
  type RoomOption,
  type AgentOption,
} from "@/components/decisions/GenerateDecisionForm";

// DecisionsPanel — stateful container for a workspace's decision summaries.
//
// Fetches the decisions (any member may view) plus the rooms and agents needed
// to generate a new one and to label each decision's room. For owners/admins/
// members it owns the generate flow; the API enforces every permission and
// validation rule, this only mirrors the check to shape the UI.

export function DecisionsPanel({ workspaceId }: { workspaceId: string }) {
  const [decisions, setDecisions] = useState<DecisionSummary[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canGenerate = canGenerateSummaries(role);
  const roomName = (roomId: string | null) =>
    roomId ? rooms.find((r) => r.id === roomId)?.name ?? null : null;

  const refresh = useCallback(async () => {
    try {
      // Rooms and agents power the generate form and room labels; a failure
      // there is non-fatal (decisions still list, scopes just show "Unknown").
      const [decRes, roomRes, agentRes] = await Promise.all([
        fetch(`/api/decisions?workspaceId=${workspaceId}`),
        fetch(`/api/rooms?workspaceId=${workspaceId}`),
        fetch(`/api/agents?workspaceId=${workspaceId}`),
      ]);
      if (!decRes.ok) {
        const data = await decRes.json().catch(() => null);
        throw new Error(data?.error || "Failed to load decisions");
      }
      const decData = await decRes.json();
      setDecisions(decData.decisions ?? []);
      setRole(decData.role ?? "viewer");
      if (roomRes.ok) {
        const roomData = await roomRes.json();
        setRooms(
          (roomData.rooms ?? []).map((r: { id: string; name: string }) => ({
            id: r.id,
            name: r.name,
          }))
        );
      }
      if (agentRes.ok) {
        const agentData = await agentRes.json();
        setAgents(
          (agentData.agents ?? [])
            .filter((a: { isActive?: boolean }) => a.isActive !== false)
            .map((a: { id: string; displayName: string }) => ({
              id: a.id,
              displayName: a.displayName,
            }))
        );
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleGenerate(values: GenerateDecisionValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/summaries/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          roomId: values.roomId,
          agentId: values.agentId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate summary");
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to generate summary"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading decisions…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {canGenerate && !formOpen && (
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setFormOpen(true);
          }}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
        >
          + Generate decision summary
        </button>
      )}

      {canGenerate && formOpen && (
        <GenerateDecisionForm
          rooms={rooms}
          agents={agents}
          submitting={submitting}
          error={formError}
          onSubmit={handleGenerate}
          onCancel={() => {
            setFormOpen(false);
            setFormError(null);
          }}
        />
      )}

      {decisions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No decisions yet.
          {canGenerate
            ? " Generate a summary to capture what your team decided in a room."
            : ""}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {decisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              roomName={roomName(decision.roomId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
