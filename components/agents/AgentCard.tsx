"use client";

import { providerLabel, modelLabel } from "@/lib/agents/registry";
import { AgentAvatar } from "@/components/agents/AgentAvatar";

// AgentCard — presentational summary of one AI agent in the workspace roster.
//
// Shows identity (avatar, display name, @handle), provider/model, role, and
// active status. Management actions (edit, activate/deactivate, delete) are
// rendered only when the viewer can manage agents; callbacks are owned by the
// parent panel.

export type AgentSummary = {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  model: string;
  role: string;
  systemPrompt: string;
  avatarUrl: string | null;
  isActive: boolean;
};

const PROVIDER_BADGE: Record<string, string> = {
  openai: "border-emerald-700/60 text-emerald-300",
  anthropic: "border-orange-700/60 text-orange-300",
  gemini: "border-sky-700/60 text-sky-300",
};

export function AgentCard({
  agent,
  canManage,
  busy,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  agent: AgentSummary;
  canManage: boolean;
  busy: boolean;
  onEdit: (agent: AgentSummary) => void;
  onToggleActive: (agent: AgentSummary) => void;
  onDelete: (agent: AgentSummary) => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border bg-neutral-900 p-5 transition-colors ${
        agent.isActive
          ? "border-neutral-800"
          : "border-neutral-800/60 opacity-70"
      }`}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar
          displayName={agent.displayName}
          avatarUrl={agent.avatarUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-neutral-100">
              {agent.displayName}
            </h3>
            {!agent.isActive && (
              <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                Inactive
              </span>
            )}
          </div>
          <p className="truncate text-xs text-neutral-500">@{agent.name}</p>
          <p className="mt-1 text-sm text-neutral-400">{agent.role}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            PROVIDER_BADGE[agent.provider] ?? "border-neutral-700 text-neutral-300"
          }`}
        >
          {providerLabel(agent.provider)}
        </span>
        <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-xs text-neutral-500">
          {modelLabel(agent.provider, agent.model)}
        </span>
      </div>

      {canManage && (
        <div className="mt-4 flex items-center gap-2 border-t border-neutral-800 pt-4">
          <button
            type="button"
            onClick={() => onEdit(agent)}
            disabled={busy}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onToggleActive(agent)}
            disabled={busy}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
          >
            {agent.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(agent)}
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
