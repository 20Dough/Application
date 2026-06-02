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
import { AuthForm } from "@/components/auth/AuthForm";
import { ManageTeam } from "@/components/workspace/ManageTeam";
import { ManageAgents } from "@/components/workspace/ManageAgents";
import {
  addMemory,
  addProjectContext,
  createRoom,
  fetchBootstrap,
  fetchMe,
  fetchMessages,
  generateSummary,
  logout,
  sendMessage,
  type BootstrapData,
} from "@/lib/client-api";

/**
 * Top-level workspace UI — three-pane layout (sidebar / chat / right panel)
 * wired to the real backend. Messages flow through POST /api/messages, which
 * runs the AI Router server-side. The frontend never calls AI providers.
 */
export function WorkspaceView() {
  const [authChecked, setAuthChecked] = useState(false);
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

  // Which management modal is open, if any.
  const [modal, setModal] = useState<"team" | "agents" | null>(null);

  // Load the full workspace for the signed-in user.
  const loadWorkspace = useCallback(() => {
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

  // On mount, check whether there is an active session.
  useEffect(() => {
    fetchMe()
      .then((user) => {
        setCurrentUser(user);
        setAuthChecked(true);
        if (user) loadWorkspace();
      })
      .catch(() => setAuthChecked(true));
  }, [loadWorkspace]);

  function handleAuthenticated(user: User) {
    setCurrentUser(user);
    loadWorkspace();
  }

  async function handleLogout() {
    await logout();
    // Reset to the signed-out state.
    setCurrentUser(null);
    setData(null);
    setWorkspace(null);
    setMessages([]);
    setActiveRoomId(null);
  }

  // Load messages when switching rooms
  const selectRoom = useCallback(async (roomId: string) => {
    setActiveRoomId(roomId);
    try {
      setMessages(await fetchMessages(roomId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Realtime: subscribe to the active room's SSE stream and append incoming
  // messages live. Deduped by id so messages this client already added (via the
  // POST response or optimistic update) don't appear twice.
  useEffect(() => {
    if (!activeRoomId) return;
    const source = new EventSource(`/api/rooms/${activeRoomId}/stream`);

    source.onmessage = (e) => {
      const event = JSON.parse(e.data) as
        | { type: "message"; message: Message }
        | { type: "ping" };
      if (event.type !== "message") return;
      const incoming = event.message;

      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        // Drop a matching optimistic message from this client, if any.
        const withoutOptimistic = prev.filter(
          (m) =>
            !(
              m.id.startsWith("optimistic_") &&
              m.senderType === "human" &&
              m.content === incoming.content &&
              m.userId === incoming.userId
            ),
        );
        return [...withoutOptimistic, incoming];
      });
    };

    // EventSource auto-reconnects; surface only persistent failures quietly.
    source.onerror = () => {
      // Keep the connection object; the browser retries automatically.
    };

    return () => source.close();
  }, [activeRoomId]);

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
      // The saved human message and AI replies also arrive via the SSE stream;
      // the stream handler swaps this optimistic placeholder for the real
      // message (matched on content) so we don't need the response here.
      await sendMessage(activeRoomId, content);
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

  // Still checking the session — show a neutral splash.
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-hive-bg">
        <div className="animate-pulse text-sm text-hive-muted">Loading…</div>
      </div>
    );
  }

  // Not signed in — show the auth screen.
  if (!currentUser) {
    return <AuthForm onAuthenticated={handleAuthenticated} />;
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
            Did you run{" "}
            <code className="text-hive-accent">npm run db:push</code>?
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
        currentUser={currentUser}
        activeRoomId={activeRoom.id}
        onSelectRoom={selectRoom}
        onCreateRoom={handleCreateRoom}
        onManageTeam={() => setModal("team")}
        onLogout={handleLogout}
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
        onManageAgents={() => setModal("agents")}
      />

      {modal === "team" && (
        <ManageTeam
          workspaceId={workspace.id}
          currentUser={currentUser}
          members={members}
          canManage={canManage}
          onClose={() => setModal(null)}
          onMembersChange={setMembers}
        />
      )}
      {modal === "agents" && (
        <ManageAgents
          workspaceId={workspace.id}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          agents={agents}
          onClose={() => setModal(null)}
          onAgentsChange={setAgents}
        />
      )}
    </div>
  );
}
