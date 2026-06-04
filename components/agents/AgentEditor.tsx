"use client";

import { useState } from "react";
import type { Agent, ProviderName } from "@/types";
import { cn, initials, providerColor } from "@/lib/utils";
import { MODEL_CATALOG, modelsForProvider } from "@/lib/ai/model-catalog";

interface AgentEditorProps {
  agents: Agent[];
  /** Admins/owners can edit; everyone else sees a read-only list. */
  canManage: boolean;
  onUpdate: (
    agentId: string,
    patch: Partial<
      Pick<Agent, "displayName" | "provider" | "model" | "role" | "isActive">
    >,
  ) => Promise<void>;
}

const PROVIDERS: ProviderName[] = ["openai", "anthropic", "gemini"];

export function AgentEditor({ agents, canManage, onUpdate }: AgentEditorProps) {
  return (
    <ul className="space-y-1.5">
      {agents.map((agent) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          canManage={canManage}
          onUpdate={onUpdate}
        />
      ))}
    </ul>
  );
}

function AgentRow({
  agent,
  canManage,
  onUpdate,
}: {
  agent: Agent;
  canManage: boolean;
  onUpdate: AgentEditorProps["onUpdate"];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent.displayName);
  const [role, setRole] = useState(agent.role);
  const [provider, setProvider] = useState<ProviderName>(agent.provider);
  const [model, setModel] = useState(agent.model);
  const [busy, setBusy] = useState(false);

  const color = providerColor(agent.provider);
  const providerModels = modelsForProvider(provider);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await onUpdate(agent.id, {
        displayName: name.trim() || agent.displayName,
        role: role.trim(),
        provider,
        model,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    await onUpdate(agent.id, { isActive: !agent.isActive });
  }

  function startEdit() {
    setName(agent.displayName);
    setRole(agent.role);
    setProvider(agent.provider);
    setModel(agent.model);
    setEditing(true);
  }

  function onProviderChange(next: ProviderName) {
    setProvider(next);
    // Keep a valid model when switching provider.
    const first = modelsForProvider(next)[0];
    if (first) setModel(first.model);
  }

  const modelLabel =
    MODEL_CATALOG.find((m) => m.model === agent.model)?.label ?? agent.model;

  if (!editing) {
    return (
      <li className="flex items-start gap-2.5 rounded-md border border-hive-border bg-hive-surface px-2.5 py-2">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials(agent.displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-hive-text">
              {agent.displayName}
            </span>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                agent.isActive ? "bg-green-500" : "bg-hive-muted",
              )}
              title={agent.isActive ? "Active" : "Inactive"}
            />
          </div>
          <p className="truncate text-xs text-hive-muted">{agent.role}</p>
          <span
            className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {agent.provider} · {modelLabel}
          </span>
          {canManage && (
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={startEdit}
                className="text-[11px] text-hive-muted transition hover:text-hive-accent"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={toggleActive}
                className="text-[11px] text-hive-muted transition hover:text-hive-accent"
              >
                {agent.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="space-y-1.5 rounded-md border border-hive-accent/40 bg-hive-surface px-2.5 py-2">
      <label className="block text-[10px] uppercase tracking-wide text-hive-muted">
        Name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-hive-border bg-hive-panel px-2 py-1 text-xs text-hive-text focus:border-hive-accent focus:outline-none"
      />
      <label className="block text-[10px] uppercase tracking-wide text-hive-muted">
        Role
      </label>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full rounded border border-hive-border bg-hive-panel px-2 py-1 text-xs text-hive-text focus:border-hive-accent focus:outline-none"
      />
      <div className="flex gap-1.5">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-wide text-hive-muted">
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as ProviderName)}
            className="w-full rounded border border-hive-border bg-hive-panel px-1.5 py-1 text-xs text-hive-text focus:border-hive-accent focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-wide text-hive-muted">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded border border-hive-border bg-hive-panel px-1.5 py-1 text-xs text-hive-text focus:border-hive-accent focus:outline-none"
          >
            {providerModels.map((m) => (
              <option key={m.model} value={m.model}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded px-2 py-1 text-xs text-hive-muted transition hover:text-hive-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-hive-accent px-2.5 py-1 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
  );
}
