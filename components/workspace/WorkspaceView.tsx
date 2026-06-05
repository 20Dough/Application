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
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PasscodeGate } from "@/components/chat/PasscodeGate";
import { RightPanel } from "@/components/workspace/RightPanel";
import { AuthScreen } from "@/components/auth/AuthScreen";
import {
  addMemory,
  addProjectContext,
  ApiError,
  createRoom,
  fetchAttachments,
  fetchBootstrap,
  fetchMessages,
  fetchTokens,
  generateSummary,
  logout,
  resendVerification,
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
  // null = still checking; true/false once we know if a session exists.
  const [authed, setAuthed] = useState<boolean | null>(null);

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

  // Mobile/tablet drawer state for the side panels.
  const [navOpen, setNavOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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
        fetchAttachments(roomId, passcode),
      ]);
      setMessages(msgs);
      setAttachments(atts);
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const d = await fetchBootstrap();
      setAuthed(true);
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
        fetchAttachments(firstRoom.id)
          .then(setAttachments)
          .catch(() => {});
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAuthed(false); // show the sign-in screen
      } else {
        setError((e as Error).message);
      }
    }
  }, [refreshTokens]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  async function handleLogout() {
    await logout();
    setAuthed(false);
    setData(null);
  }

  const [verifySent, setVerifySent] = useState(false);
  async function handleResendVerification() {
    try {
      await resendVerification();
      setVerifySent(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

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
        fetchAttachments(activeRoomId, unlocked[activeRoomId])
          .then(setAttachments)
          .catch(() => {});
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
    return uploadFile(activeRoomId, file, unlocked[activeRoomId]);
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
      const decision = await generateSummary(
        activeRoomId,
        range,
        unlocked[activeRoomId],
      );
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

  // Not signed in → show the auth screen.
  if (authed === false) {
    return (
      <AuthScreen
        onAuthed={() => {
          setAuthed(null);
          setError(null);
          load();
        }}
      />
    );
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

  const unverified = Boolean(currentUser && !currentUser.emailVerified);

  return (
    <div className="flex h-screen w-full flex-col">
      {/* Email verification banner */}
      {unverified && (
        <div className="flex items-center justify-center gap-2 border-b border-hive-border bg-hive-accent-soft px-3 py-1.5 text-center text-xs text-hive-text">
          <span>
            📧 Please verify your email
            {currentUser ? ` (${currentUser.email})` : ""}.
          </span>
          {verifySent ? (
            <span className="text-hive-muted">Sent — check your inbox.</span>
          ) : (
            <button
              type="button"
              onClick={handleResendVerification}
              className="font-medium text-hive-accent hover:underline"
            >
              Resend
            </button>
          )}
        </div>
      )}

      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
        {/* Backdrops for the mobile/tablet drawers */}
        <Backdrop
          show={navOpen}
          hideClass="lg:hidden"
          onClose={() => setNavOpen(false)}
        />
        <Backdrop
          show={infoOpen}
          hideClass="xl:hidden"
          onClose={() => setInfoOpen(false)}
        />

        {/* Sidebar — drawer below lg, static column at lg+ */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 transform shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
            navOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar
            workspace={workspace}
            rooms={rooms}
            members={members}
            currentUser={currentUser}
            activeRoomId={activeRoom.id}
            onSelectRoom={(id) => {
              selectRoom(id);
              setNavOpen(false);
            }}
            onCreateRoom={handleCreateRoom}
            onLogout={handleLogout}
            onClose={() => setNavOpen(false)}
          />
        </div>

        {/* Center column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Mobile/tablet top bar */}
          <div className="flex items-center gap-2 border-b border-hive-border bg-hive-surface px-3 py-2 xl:hidden">
            <IconButton
              onClick={() => setNavOpen(true)}
              title="Open menu"
              className="lg:hidden"
            >
              ☰
            </IconButton>
            <span className="flex flex-1 items-center gap-1.5 truncate text-sm font-semibold text-hive-text">
              <span aria-hidden>🐝</span>
              <span className="truncate">{activeRoom.name}</span>
            </span>
            <IconButton
              onClick={() => setInfoOpen(true)}
              title="Open details"
              className="text-base"
            >
              ⓘ
            </IconButton>
          </div>

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
        </div>

        {/* Right panel — drawer below xl, static column at xl+ */}
        <div
          className={cn(
            "fixed inset-y-0 right-0 z-40 w-80 max-w-[85vw] transform shadow-xl transition-transform duration-200 xl:static xl:z-auto xl:max-w-none xl:translate-x-0 xl:shadow-none",
            infoOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
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
            onClose={() => setInfoOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}

/** Dimmed click-to-close layer behind a mobile/tablet drawer. */
function Backdrop({
  show,
  hideClass,
  onClose,
}: {
  show: boolean;
  hideClass: string;
  onClose: () => void;
}) {
  if (!show) return null;
  return (
    <div
      className={cn("fixed inset-0 z-30 bg-black/50", hideClass)}
      onClick={onClose}
    />
  );
}

/** Small square icon button used in the mobile/tablet top bar. */
function IconButton({
  onClick,
  title,
  className,
  children,
}: {
  onClick: () => void;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-hive-muted transition hover:bg-hive-panel hover:text-hive-text",
        className,
      )}
    >
      {children}
    </button>
  );
}
