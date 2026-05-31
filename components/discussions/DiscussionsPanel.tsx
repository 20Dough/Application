"use client";

import { useCallback, useEffect, useState } from "react";
import { canRunDiscussions } from "@/lib/roles";
import { DiscussionCard } from "@/components/discussions/DiscussionCard";
import {
  StartDiscussionForm,
  type StartDiscussionValues,
  type RoomOption,
  type AgentOption,
} from "@/components/discussions/StartDiscussionForm";
import type {
  DiscussionDetail,
  DiscussionListItem,
} from "@/components/discussions/types";

// DiscussionsPanel — stateful container for a workspace's multi-agent
// discussions.
//
// Fetches the discussions (any member may view) plus the rooms and agents that
// power the start form and room labels. For owners/admins/members it owns the
// start flow, per-discussion detail expansion, and turning a discussion into a
// decision. The API enforces every permission and validation rule; this only
// mirrors the check to shape the UI.

function toListItem(detail: DiscussionDetail): DiscussionListItem {
  return {
    id: detail.id,
    roomId: detail.roomId,
    topic: detail.topic,
    rounds: detail.rounds,
    status: detail.status,
    summary: detail.summary,
    consensus: detail.consensus,
    disagreements: detail.disagreements,
    decisionId: detail.decisionId,
    turnCount: detail.turns.length,
    createdAt: detail.createdAt,
  };
}

export function DiscussionsPanel({ workspaceId }: { workspaceId: string }) {
  const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [details, setDetails] = useState<Record<string, DiscussionDetail>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const canRun = canRunDiscussions(role);
  const roomName = (roomId: string | null) =>
    roomId ? rooms.find((r) => r.id === roomId)?.name ?? null : null;

  const refresh = useCallback(async () => {
    try {
      // Rooms and agents power the start form and room labels; a failure there
      // is non-fatal (discussions still list, rooms just show "Unknown").
      const [discRes, roomRes, agentRes] = await Promise.all([
        fetch(`/api/discussions?workspaceId=${workspaceId}`),
        fetch(`/api/rooms?workspaceId=${workspaceId}`),
        fetch(`/api/agents?workspaceId=${workspaceId}`),
      ]);
      if (!discRes.ok) {
        const data = await discRes.json().catch(() => null);
        throw new Error(data?.error || "Failed to load discussions");
      }
      const discData = await discRes.json();
      setDiscussions(discData.discussions ?? []);
      setRole(discData.role ?? "viewer");
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
      setError(err instanceof Error ? err.message : "Failed to load discussions");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function loadDetail(id: string) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/discussions/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load discussion");
      }
      const data = await res.json();
      setDetails((d) => ({ ...d, [id]: data.discussion }));
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Failed to load discussion"
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function handleToggle(id: string) {
    setGenerateError(null);
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!details[id]) void loadDetail(id);
  }

  async function handleStart(values: StartDiscussionValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          roomId: values.roomId,
          topic: values.topic,
          agentIds: values.agentIds,
          rounds: values.rounds,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to run discussion");
      }
      const detail: DiscussionDetail = data.discussion;
      setDetails((d) => ({ ...d, [detail.id]: detail }));
      setDiscussions((list) => [toListItem(detail), ...list]);
      setExpandedId(detail.id);
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to run discussion");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateDecision() {
    if (!expandedId) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/discussions/${expandedId}/decision`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate decision");
      }
      // Reload the detail so the decision link appears, and refresh the list so
      // the card's "decision ✓" badge updates.
      await loadDetail(expandedId);
      await refresh();
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Failed to generate decision"
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading discussions…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {canRun && !formOpen && (
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setFormOpen(true);
          }}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
        >
          + Start a discussion
        </button>
      )}

      {canRun && formOpen && (
        <StartDiscussionForm
          rooms={rooms}
          agents={agents}
          submitting={submitting}
          error={formError}
          onSubmit={handleStart}
          onCancel={() => {
            setFormOpen(false);
            setFormError(null);
          }}
        />
      )}

      {discussions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No discussions yet.
          {canRun
            ? " Start one to have your AI teammates reason through a topic together."
            : ""}
        </p>
      ) : (
        <div className="space-y-4">
          {discussions.map((item) => (
            <DiscussionCard
              key={item.id}
              workspaceId={workspaceId}
              item={item}
              roomName={roomName(item.roomId)}
              expanded={expandedId === item.id}
              detail={details[item.id] ?? null}
              detailLoading={expandedId === item.id && detailLoading}
              detailError={expandedId === item.id ? detailError : null}
              onToggle={() => handleToggle(item.id)}
              canGenerate={canRun}
              generating={expandedId === item.id && generating}
              generateError={expandedId === item.id ? generateError : null}
              onGenerateDecision={handleGenerateDecision}
            />
          ))}
        </div>
      )}
    </div>
  );
}
