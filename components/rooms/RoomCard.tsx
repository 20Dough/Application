"use client";

import Link from "next/link";
import { AgentAvatar } from "@/components/agents/AgentAvatar";

// RoomCard — presentational summary of one room in the workspace list.
//
// Shows the room name, description, the number of AI agents, and the default
// agent when set. The whole card links through to the room detail page. Delete
// is rendered only when the viewer can manage rooms; the callback is owned by
// the parent panel.

export type RoomSummary = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  defaultAgentId: string | null;
  defaultAgent: {
    id: string;
    name: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  agentCount: number;
};

export function RoomCard({
  room,
  canManage,
  busy,
  onDelete,
}: {
  room: RoomSummary;
  canManage: boolean;
  busy: boolean;
  onDelete: (room: RoomSummary) => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-neutral-600">
      <Link
        href={`/workspace/${room.workspaceId}/rooms/${room.id}`}
        className="min-w-0"
      >
        <h3 className="truncate font-semibold text-neutral-100"># {room.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-neutral-400">
          {room.description || "No description"}
        </p>
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span className="rounded-full border border-neutral-800 px-2 py-0.5">
          {room.agentCount} {room.agentCount === 1 ? "agent" : "agents"}
        </span>
        {room.defaultAgent && (
          <span className="flex items-center gap-1.5 rounded-full border border-neutral-800 px-2 py-0.5">
            <AgentAvatar
              displayName={room.defaultAgent.displayName}
              avatarUrl={room.defaultAgent.avatarUrl}
              size="sm"
            />
            <span>Default: {room.defaultAgent.displayName}</span>
          </span>
        )}
      </div>

      {canManage && (
        <div className="mt-4 flex items-center gap-2 border-t border-neutral-800 pt-4">
          <Link
            href={`/workspace/${room.workspaceId}/rooms/${room.id}`}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={() => onDelete(room)}
            disabled={busy}
            className="ml-auto rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-red-700/60 hover:text-red-300 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
