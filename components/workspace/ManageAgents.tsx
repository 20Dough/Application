"use client";

import { useEffect, useState } from "react";
import type { Agent, ProviderName, RoomAgent } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { providerColor, initials } from "@/lib/utils";
import {
  addAgentToRoom,
  createAgent,
  deleteAgent,
  fetchRoomAgents,
  removeRoomAgent,
  updateAgent,
  type AgentInput,
} from "@/lib/client-api";

interface ManageAgentsProps {
  workspaceId: string;
  roomId: string;
  roomName: string;
  agents: Agent[];
  onClose: () => void;
  onAgentsChange: (agents: Agent[]) => void;
}

const PROVIDERS: ProviderName[] = ["openai", "anthropic", "gemini"];

export function ManageAgents({
  workspaceId,
  roomId,
  roomName,
  agents,
  onClose,
  onAgentsChange,
}: ManageAgentsProps) {
  const [roomAgents, setRoomAgents] = useState<RoomAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchRoomAgents(roomId)
      .then(setRoomAgents)
      .catch(() => {});
  }, [roomId]);

  const inRoom = (agentId: string) =>
    roomAgents.find((ra) => ra.agentId === agentId);

  async function toggleActive(agent: Agent) {
    try {
      const updated = await updateAgent(agent.id, {
        isActive: !agent.isActive,
      });
      onAgentsChange(
        agents.map((a) =>
          a.id === agent.id ? { ...a, isActive: updated.isActive } : a,
        ),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleRoom(agent: Agent) {
    try {
      const existing = inRoom(agent.id);
      if (existing) {
        await removeRoomAgent(existing.id);
        setRoomAgents((prev) => prev.filter((ra) => ra.id !== existing.id));
      } else {
        const ra = await addAgentToRoom(roomId, agent.id);
        setRoomAgents((prev) => [...prev, ra]);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(agent: Agent) {
    if (!window.confirm(`Delete agent ${agent.displayName}?`)) return;
    try {
      await deleteAgent(agent.id);
      onAgentsChange(agents.filter((a) => a.id !== agent.id));
      setRoomAgents((prev) => prev.filter((ra) => ra.agentId !== agent.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCreate(input: AgentInput) {
    const agent = await createAgent(workspaceId, input);
    onAgentsChange([...agents, agent]);
    setCreating(false);
  }

  return (
    <Modal title="AI agents" onClose={onClose}>
      {error && (
        <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {agents.map((agent) => {
          const color = providerColor(agent.provider);
          const member = !!inRoom(agent.id);
          return (
            <li
              key={agent.id}
              className="rounded-md border border-hive-border bg-hive-panel px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {initials(agent.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-hive-text">
                    {agent.displayName}
                  </p>
                  <p className="truncate text-xs text-hive-muted">
                    {agent.role} · {agent.provider}/{agent.model}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(agent)}
                  className="rounded px-1.5 py-0.5 text-xs text-hive-muted transition hover:text-red-400"
                >
                  Delete
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Toggle
                  on={agent.isActive}
                  onLabel="Active"
                  offLabel="Inactive"
                  onClick={() => toggleActive(agent)}
                />
                <Toggle
                  on={member}
                  onLabel={`In #${roomName}`}
                  offLabel={`Add to #${roomName}`}
                  onClick={() => toggleRoom(agent)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Create */}
      <div className="mt-4 border-t border-hive-border pt-4">
        {creating ? (
          <CreateAgentForm
            onCancel={() => setCreating(false)}
            onCreate={handleCreate}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full rounded-md border border-dashed border-hive-border px-3 py-2 text-xs text-hive-muted transition hover:border-hive-accent hover:text-hive-accent"
          >
            + New agent
          </button>
        )}
      </div>
    </Modal>
  );
}

function Toggle({
  on,
  onLabel,
  offLabel,
  onClick,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-2.5 py-0.5 text-[11px] transition " +
        (on
          ? "border-hive-accent bg-hive-accent-soft text-hive-accent"
          : "border-hive-border text-hive-muted hover:text-hive-text")
      }
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

function CreateAgentForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: AgentInput) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [provider, setProvider] = useState<ProviderName>("openai");
  const [model, setModel] = useState("");
  const [role, setRole] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !model.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        // name is the normalized handle used for @mentions
        name: displayName.trim().toLowerCase().replace(/\s+/g, ""),
        displayName: displayName.trim(),
        provider,
        model: model.trim(),
        role: role.trim() || "Teammate",
        systemPrompt: systemPrompt.trim(),
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name (e.g. Scout)"
          className="flex-1 rounded border border-hive-border bg-hive-surface px-2 py-1.5 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
        />
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderName)}
          className="rounded border border-hive-border bg-hive-surface px-2 py-1.5 text-sm text-hive-text focus:border-hive-accent focus:outline-none"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model (e.g. gpt-4o)"
          className="flex-1 rounded border border-hive-border bg-hive-surface px-2 py-1.5 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role"
          className="flex-1 rounded border border-hive-border bg-hive-surface px-2 py-1.5 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
        />
      </div>
      <textarea
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        placeholder="System prompt — who is this agent and how should it behave?"
        rows={3}
        className="w-full resize-none rounded border border-hive-border bg-hive-surface px-2 py-1.5 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-sm text-hive-muted transition hover:text-hive-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !displayName.trim() || !model.trim()}
          className="rounded-md bg-hive-accent px-3 py-1.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create agent"}
        </button>
      </div>
    </form>
  );
}
