"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { canManageRooms } from "@/lib/roles";
import { useVisiblePolling } from "@/lib/hooks/use-visible-polling";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { RoomChat } from "@/components/rooms/chat/RoomChat";

// RoomDetail — stateful container for a single room (the room chat page).
//
// Lays out the room as a chat: the conversation (RoomChat) is the primary panel
// and a sidebar lists the room's participants — the workspace's human members (a
// room's humans are simply the workspace's humans) and the AI agents added to
// the room. For owners/admins the sidebar owns the mutating actions: add an
// agent, remove an agent, and set/clear the default agent. The API enforces
// every permission rule; this component mirrors the permission check only to
// shape the UI.

// How often the room re-fetches its participants (ms) so agent membership and
// the default-agent choice stay current when teammates change them elsewhere.
const PARTICIPANT_POLL_INTERVAL_MS = 8000;

type RoomAgent = {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  model: string;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
};

type RoomMember = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

type RoomData = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  defaultAgentId: string | null;
};

const ROLE_BADGE: Record<string, string> = {
  owner: "border-amber-700/60 text-amber-300",
  admin: "border-sky-700/60 text-sky-300",
  member: "border-neutral-700 text-neutral-300",
  viewer: "border-neutral-800 text-neutral-500",
};

export function RoomDetail({
  workspaceId,
  roomId,
}: {
  workspaceId: string;
  roomId: string;
}) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [agents, setAgents] = useState<RoomAgent[]>([]);
  const [availableAgents, setAvailableAgents] = useState<RoomAgent[]>([]);
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const canManage = canManageRooms(role);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ||
            (res.status === 403
              ? "You do not have access to this room"
              : "Room not found")
        );
      }
      const data = await res.json();
      setRoom(data.room);
      setMembers(data.members ?? []);
      setAgents(data.agents ?? []);
      setAvailableAgents(data.availableAgents ?? []);
      setRole(data.role ?? "viewer");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load room");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Lightweight realtime refresh of participants: updates the room, its agents,
  // and members in place. Transient failures are ignored (the next tick
  // retries) so polling never replaces a working view with an error and never
  // toggles the initial loading state.
  const pollRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) return;
      const data = await res.json();
      setRoom(data.room);
      setMembers(data.members ?? []);
      setAgents(data.agents ?? []);
      setAvailableAgents(data.availableAgents ?? []);
      setRole(data.role ?? "viewer");
    } catch {
      /* transient — retry on the next tick */
    }
  }, [roomId]);

  useVisiblePolling(pollRoom, PARTICIPANT_POLL_INTERVAL_MS);

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

  function handleAddAgent() {
    if (!selectedAgentId) return;
    const agentId = selectedAgentId;
    setSelectedAgentId("");
    runAction(`add:${agentId}`, () =>
      fetch(`/api/rooms/${roomId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      })
    );
  }

  function handleRemoveAgent(agent: RoomAgent) {
    runAction(agent.id, () =>
      fetch(`/api/rooms/${roomId}/agents/${agent.id}`, { method: "DELETE" })
    );
  }

  function handleSetDefault(agentId: string | null) {
    runAction(agentId ? `default:${agentId}` : "default:clear", () =>
      fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultAgentId: agentId }),
      })
    );
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading room…</p>;
  }
  if (error || !room) {
    return (
      <div className="rounded-lg border border-neutral-800 p-8 text-center">
        <p className="text-sm text-red-400">{error || "Room not found"}</p>
        <Link
          href={`/workspace/${workspaceId}/rooms`}
          className="mt-4 inline-block text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Back to rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight"># {room.name}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {room.description || "No description"}
          </p>
        </div>
        <Link
          href={`/workspace/${workspaceId}/rooms`}
          className="shrink-0 text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Back to rooms
        </Link>
      </div>

      {actionError && (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Conversation — the primary panel. Only humans can post in this phase. */}
        <div className="lg:col-span-2">
          <RoomChat roomId={roomId} />
        </div>

        {/* Participants sidebar: AI agents and human members. */}
        <aside className="space-y-8">
      {/* AI agents in the room */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          AI agents ({agents.length})
        </h2>

        {canManage && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              aria-label="Add an agent to the room"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              disabled={availableAgents.length === 0 || busyId !== null}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-500 disabled:opacity-50"
            >
              <option value="">
                {availableAgents.length === 0
                  ? "No more agents to add"
                  : "Select an agent…"}
              </option>
              {availableAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} (@{a.name})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddAgent}
              disabled={!selectedAgentId || busyId !== null}
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add agent
            </button>
          </div>
        )}

        {agents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
            No AI agents in this room yet.
            {canManage ? " Add one from the workspace team above." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
            {agents.map((agent) => {
              const isDefault = room.defaultAgentId === agent.id;
              const busy = busyId === agent.id;
              return (
                <li
                  key={agent.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AgentAvatar
                      displayName={agent.displayName}
                      avatarUrl={agent.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-neutral-100">
                        {agent.displayName}
                        {isDefault && (
                          <span className="shrink-0 rounded-full border border-emerald-700/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                            Default
                          </span>
                        )}
                        {!agent.isActive && (
                          <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {agent.role} · @{agent.name}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleSetDefault(isDefault ? null : agent.id)
                        }
                        disabled={busyId !== null}
                        className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
                      >
                        {isDefault ? "Clear default" : "Set default"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAgent(agent)}
                        disabled={busy || busyId !== null}
                        className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-red-700/60 hover:text-red-300 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Human members (= workspace members) */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Humans ({members.length})
        </h2>
        <p className="mb-3 text-xs text-neutral-600">
          Everyone in the workspace is a member of every room. Manage the human
          team from the workspace members page.
        </p>
        <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {member.user.name || member.user.email}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {member.user.email}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize ${
                  ROLE_BADGE[member.role] ?? ROLE_BADGE.member
                }`}
              >
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
        </aside>
      </div>
    </div>
  );
}
