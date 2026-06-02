"use client";

import type { Room, User, Workspace, WorkspaceMember } from "@/types";
import { cn, initials } from "@/lib/utils";

interface SidebarProps {
  workspace: Workspace;
  rooms: Room[];
  members: WorkspaceMember[];
  currentUser: User;
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: () => void;
  onManageTeam: () => void;
  onLogout: () => void;
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
  currentUser,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onManageTeam,
  onLogout,
}: SidebarProps) {
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
          {rooms.map((room) => (
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
              <span className="text-hive-muted">#</span>
              <span className="truncate">{room.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Members */}
      <div className="border-t border-hive-border px-2 py-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-hive-muted">
            Team Members
          </span>
          <button
            type="button"
            onClick={onManageTeam}
            className="text-[11px] text-hive-muted transition hover:text-hive-accent"
          >
            Manage
          </button>
        </div>
        <ul className="space-y-1">
          {members.map((member) => (
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

      {/* Current user + logout */}
      <div className="flex items-center gap-2 border-t border-hive-border px-3 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-hive-accent text-[10px] font-bold text-black">
          {initials(currentUser.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-hive-text">
            {currentUser.name}
          </p>
          <p className="truncate text-[11px] text-hive-muted">
            @{currentUser.username}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          className="rounded-md px-2 py-1 text-xs text-hive-muted transition hover:bg-hive-panel hover:text-hive-text"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
