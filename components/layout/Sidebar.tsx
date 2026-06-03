"use client";

import { useMemo, useState } from "react";
import type { Room, Workspace, WorkspaceMember } from "@/types";
import { cn, initials } from "@/lib/utils";

interface SidebarProps {
  workspace: Workspace;
  rooms: Room[];
  members: WorkspaceMember[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: () => void;
}

const roleBadge: Record<string, string> = {
  owner: "text-hive-accent",
  admin: "text-blue-400",
  member: "text-hive-muted",
  viewer: "text-hive-muted",
};

export function Sidebar({
  workspace,
  rooms,
  members,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
}: SidebarProps) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filteredRooms = useMemo(
    () => (q ? rooms.filter((r) => r.name.toLowerCase().includes(q)) : rooms),
    [rooms, q],
  );
  const filteredMembers = useMemo(
    () =>
      q
        ? members.filter((m) =>
            (m.user?.name ?? "").toLowerCase().includes(q),
          )
        : members,
    [members, q],
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r border-hive-border bg-hive-surface">
      {/* Workspace header */}
      <div className="flex items-center gap-3 border-b border-hive-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-hive-accent text-sm font-bold text-black">
          🐝
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-hive-text">
            {workspace.name}
          </h1>
          <p className="truncate text-xs text-hive-muted">Workspace</p>
        </div>
      </div>

      {/* Search rooms / people */}
      <div className="px-3 pt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rooms or people…"
          className="w-full rounded-md border border-hive-border bg-hive-panel px-2.5 py-1.5 text-xs text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
        />
      </div>

      {/* Rooms */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-hive-muted">
            Rooms
          </span>
          <button
            type="button"
            title="Create room"
            onClick={onCreateRoom}
            className="flex h-5 w-5 items-center justify-center rounded text-hive-muted transition hover:bg-hive-panel hover:text-hive-text"
          >
            +
          </button>
        </div>
        <nav className="space-y-0.5">
          {filteredRooms.length === 0 && (
            <p className="px-2 py-1 text-xs text-hive-muted">No rooms match.</p>
          )}
          {filteredRooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => onSelectRoom(room.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
                room.id === activeRoomId
                  ? "bg-hive-panel text-hive-text"
                  : "text-hive-muted hover:bg-hive-panel/60 hover:text-hive-text",
              )}
            >
              <span className="text-hive-muted">{room.isLocked ? "🔒" : "#"}</span>
              <span className="truncate">{room.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Members */}
      <div className="border-t border-hive-border px-2 py-3">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-hive-muted">
          Team Members
        </div>
        <ul className="space-y-1">
          {filteredMembers.length === 0 && (
            <li className="px-2 py-1 text-xs text-hive-muted">
              No people match.
            </li>
          )}
          {filteredMembers.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-md px-2 py-1"
            >
              <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-hive-panel text-[10px] font-semibold text-hive-text">
                {initials(member.user?.name ?? "?")}
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-hive-surface bg-green-500" />
              </span>
              <span className="flex-1 truncate text-sm text-hive-text">
                {member.user?.name}
              </span>
              <span
                className={cn(
                  "text-[10px] uppercase",
                  roleBadge[member.role] ?? "text-hive-muted",
                )}
              >
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
