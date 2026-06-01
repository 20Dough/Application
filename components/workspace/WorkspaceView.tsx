"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Agent,
  Decision,
  MemoryItem,
  Message,
  ProjectContext,
  Room,
  User,
  Workspace,
  WorkspaceMember,
} from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RightPanel } from "@/components/workspace/RightPanel";
import {
  addMemory,
  addProjectContext,
  createRoom,
  fetchBootstrap,
  fetchMessages,
  generateSummary,
  sendMessage,
  type BootstrapData,
} from "@/lib/client-api";

/**
 * Top-level workspace UI — three-pane layout (sidebar / chat / right panel)
 * wired to the real backend. Messages flow through POST /api/messages, which
 * runs the AI Router server-side. The frontend never calls AI providers.
 */
export function WorkspaceView() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext[]>([]);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);

  // Initial load
  useEffect(() => {
    fetchBootstrap()
      .then((d) => {
        setData(d);
        setCurrentUser(d.currentUser);
        setWorkspace(d.workspace);
        setMembers(d.members);
        setRooms(d.rooms);
        setAgents(d.agents);
        setProjectContext(d.projectContext);
        setMemory(d.memory);
        setDecisions(d.decisions);
        setActiveRoomId(d.activeRoomId);
        setMessages(d.messages);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Load messages when switching rooms
  const selectRoom = useCallback(
    async (roomId: string) => {
      setActiveRoomId(roomId);
      try {
        setMessages(await fetchMessages(roomId));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [],
  );

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

  // Whether the current user can manage workspace data (admin/owner).
  const canManage = useMemo(() => {
    const me = members.find((m) => m.userId === currentUser?.id);
    return me?.role === "owner" || me?.role === "admin";
  }, [members, currentUser]);

  async function handleSend(content: string) {
    if (!activeRoomId || sending) return;
    setSending(true);

    // Optimistic human message
    const optimistic: Message = {
      id: `optimistic_${Date.now()}`,
      roomId: activeRoomId,
      senderType: "human",
      userId: currentUser?.id,
      senderName: currentUser?.name,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { humanMessage, agentMessages } = await sendMessage(
        activeRoomId,
        content,
      );
      // Replace the optimistic message with the saved one + AI replies
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        humanMessage,
        ...agentMessages,
      ]);
    } catch (e) {
      setError((e as Error).message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  async function handleCreateRoom() {
    if (!workspace) return;
    const name = window.prompt("New room name");
    if (!name?.trim()) return;
    try {
      const room = await createRoom(workspace.id, name.trim());
      setRooms((prev) => [...prev, room]);
      await selectRoom(room.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleGenerateSummary() {
    if (!activeRoomId) return;
    try {
      const decision = await generateSummary(activeRoomId);
      setDecisions((prev) => [decision, ...prev]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleAddMemory(title: string, content: string) {
    if (!workspace) return;
    const item = await addMemory(workspace.id, title, content);
    setMemory((prev) =>
      [...prev, item].sort((a, b) => b.importance - a.importance),
    );
  }

  async function handleAddContext(title: string, content: string) {
    if (!workspace) return;
    const item = await addProjectContext(workspace.id, title, content);
    setProjectContext((prev) => [...prev, item]);
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-hive-bg p-6 text-center">
        <div>
          <p className="mb-2 text-lg font-semibold text-hive-text">
            Could not load HiveMind
          </p>
          <p className="text-sm text-hive-muted">{error}</p>
          <p className="mt-4 text-xs text-hive-muted">
            Did you run <code className="text-hive-accent">npm run db:push</code>?
          </p>
        </div>
      </div>
    );
  }

  if (!data || !workspace || !activeRoom) {
    return (
      <div className="flex h-screen items-center justify-center bg-hive-bg">
        <div className="animate-pulse text-sm text-hive-muted">
          Loading workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        workspace={workspace}
        rooms={rooms}
        members={members}
        activeRoomId={activeRoom.id}
        onSelectRoom={selectRoom}
        onCreateRoom={handleCreateRoom}
      />
      <ChatPanel
        room={activeRoom}
        messages={messages}
        agents={agents}
        sending={sending}
        onSend={handleSend}
        onGenerateSummary={handleGenerateSummary}
      />
      <RightPanel
        agents={agents}
        projectContext={projectContext}
        memory={memory}
        decisions={decisions}
        canManage={canManage}
        onAddMemory={handleAddMemory}
        onAddContext={handleAddContext}
      />
    </div>
  );
}
