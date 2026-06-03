"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Agent,
  Attachment,
  Decision,
  MemoryItem,
  Message,
  ProjectContext,
  Room,
  TokenInfo,
  User,
  Workspace,
  WorkspaceMember,
} from "@/types";
import type { SummaryRange } from "@/lib/summary/decision-summary";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PasscodeGate } from "@/components/chat/PasscodeGate";
import { RightPanel } from "@/components/workspace/RightPanel";
import {
  addMemory,
  addProjectContext,
  createRoom,
  fetchAttachments,
  fetchBootstrap,
  fetchMessages,
  fetchTokens,
  generateSummary,
  sendMessage,
  setRoomPasscode,
  updateAgent,
  uploadFile,
  verifyRoomPasscode,
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
  const [tokens, setTokens] = useState<TokenInfo | null>(null);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);

  // Passcode that has unlocked a given room this session (roomId → passcode).
  const [unlocked, setUnlocked] = useState<Record<string, string>>({});
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  const refreshTokens = useCallback((workspaceId: string) => {
    fetchTokens(workspaceId)
      .then(setTokens)
      .catch(() => {});
  }, []);

  const loadRoomData = useCallback(
    async (roomId: string, passcode?: string) => {
      const [msgs, atts] = await Promise.all([
        fetchMessages(roomId, passcode),
        fetchAttachments(roomId),
      ]);
      setMessages(msgs);
      setAttachments(atts);
    },
    [],
  );

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
        refreshTokens(d.workspace.id);

        const firstRoom = d.rooms.find((r) => r.id === d.activeRoomId);
        if (firstRoom && !firstRoom.isLocked) {
          fetchAttachments(firstRoom.id).then(setAttachments).catch(() => {});
        }
      })
      .catch((e) => setError(e.message));
  }, [refreshTokens]);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

  const roomLocked = Boolean(
    activeRoom?.isLocked && unlocked[activeRoom.id] === undefined,
  );

  // Load messages when switching rooms (respecting locks).
  const selectRoom = useCallback(
    async (roomId: string) => {
      setActiveRoomId(roomId);
      setPasscodeError(null);
      const room = rooms.find((r) => r.id === roomId);
      if (room?.isLocked && unlocked[roomId] === undefined) {
        setMessages([]);
        setAttachments([]);
        return;
      }
      try {
        await loadRoomData(roomId, unlocked[roomId]);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [rooms, unlocked, loadRoomData],
  );

  // Whether the current user can manage workspace data (admin/owner).
  const canManage = useMemo(() => {
    const me = members.find((m) => m.userId === currentUser?.id);
    return me?.role === "owner" || me?.role === "admin";
  }, [members, currentUser]);

  async function handleUnlock(passcode: string) {
    if (!activeRoomId) return;
    setPasscodeError(null);
    try {
      await verifyRoomPasscode(activeRoomId, passcode);
      setUnlocked((prev) => ({ ...prev, [activeRoomId]: passcode }));
      await loadRoomData(activeRoomId, passcode);
    } catch (e) {
      setPasscodeError((e as Error).message || "Incorrect passcode");
    }
  }

  async function handleSetPasscode() {
    if (!activeRoomId) return;
    const input = window.prompt(
      "Set a passcode for this room (leave blank to remove):",
    );
    if (input === null) return; // cancelled
    const value = input.trim();
    try {
      const updated = await setRoomPasscode(activeRoomId, value || null);
      setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setUnlocked((prev) => {
        const next = { ...prev };
        if (value) next[activeRoomId] = value;
        else delete next[activeRoomId];
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSend(content: string, attachmentIds: string[]) {
    if (!activeRoomId || sending) return;
    setSending(true);

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
        attachmentIds,
        unlocked[activeRoomId],
      );
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        humanMessage,
        ...agentMessages,
      ]);
      if (attachmentIds.length) {
        fetchAttachments(activeRoomId).then(setAttachments).catch(() => {});
      }
      if (workspace) refreshTokens(workspace.id);
    } catch (e) {
      setError((e as Error).message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  async function handleUploadFile(file: File): Promise<Attachment> {
    if (!activeRoomId) throw new Error("No active room");
    return uploadFile(activeRoomId, file);
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

  async function handleGenerateSummary(range: SummaryRange) {
    if (!activeRoomId) return;
    try {
      const decision = await generateSummary(activeRoomId, range);
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

  async function handleUpdateAgent(
    agentId: string,
    patch: Partial<
      Pick<Agent, "displayName" | "provider" | "model" | "role" | "isActive">
    >,
  ) {
    const updated = await updateAgent(agentId, patch);
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
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
        activeRoomId={activeRoom.id}
        onSelectRoom={selectRoom}
        onCreateRoom={handleCreateRoom}
      />
      {roomLocked ? (
        <PasscodeGate
          room={activeRoom}
          error={passcodeError}
          onUnlock={handleUnlock}
        />
      ) : (
        <ChatPanel
          room={activeRoom}
          messages={messages}
          agents={agents}
          attachments={attachments}
          currentUserId={currentUser?.id}
          sending={sending}
          onSend={handleSend}
          onUploadFile={handleUploadFile}
          onGenerateSummary={handleGenerateSummary}
          onSetPasscode={handleSetPasscode}
        />
      )}
      <RightPanel
        agents={agents}
        projectContext={projectContext}
        memory={memory}
        decisions={decisions}
        tokens={tokens}
        canManage={canManage}
        onAddMemory={handleAddMemory}
        onAddContext={handleAddContext}
        onUpdateAgent={handleUpdateAgent}
      />
    </div>
  );
}
