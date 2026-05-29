"use client";

import { useState } from "react";
import { AVAILABLE_PROVIDERS, getProvider } from "@/lib/agents/registry";
import type { AgentSummary } from "@/components/agents/AgentCard";

// AgentForm — reusable create/edit form for an AI agent profile.
//
// In "create" mode the handle (@name) is editable; in "edit" mode it is shown
// read-only because the handle anchors @mentions and is immutable. Provider and
// model selection are driven by the registry so the catalog stays in one place.

export type AgentFormValues = {
  name: string;
  displayName: string;
  provider: string;
  model: string;
  role: string;
  systemPrompt: string;
  avatarUrl: string;
};

function initialValues(agent?: AgentSummary): AgentFormValues {
  const provider = agent?.provider ?? AVAILABLE_PROVIDERS[0].id;
  return {
    name: agent?.name ?? "",
    displayName: agent?.displayName ?? "",
    provider,
    model: agent?.model ?? getProvider(provider)!.defaultModel,
    role: agent?.role ?? "",
    systemPrompt: agent?.systemPrompt ?? "",
    avatarUrl: agent?.avatarUrl ?? "",
  };
}

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500";
const labelClass = "mb-1 block text-sm text-neutral-300";

export function AgentForm({
  agent,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  /** When provided, the form edits this agent; otherwise it creates a new one. */
  agent?: AgentSummary;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: AgentFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(agent);
  const [values, setValues] = useState<AgentFormValues>(() =>
    initialValues(agent)
  );

  const providerDef = getProvider(values.provider) ?? AVAILABLE_PROVIDERS[0];

  function set<K extends keyof AgentFormValues>(key: K, value: AgentFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // Changing provider resets the model to that provider's default so the pair
  // stays valid.
  function handleProviderChange(provider: string) {
    const def = getProvider(provider);
    setValues((v) => ({
      ...v,
      provider,
      model: def?.defaultModel ?? v.model,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    onSubmit(values);
  }

  const canSubmit =
    values.name.trim() && values.role.trim() && values.systemPrompt.trim();

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="font-semibold">
        {isEdit ? `Edit ${agent!.displayName}` : "Add an AI agent"}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {isEdit
          ? "Update this teammate's identity, model, and instructions."
          : "Give your AI teammate an identity, pick a provider/model, and describe its role."}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="agent-name" className={labelClass}>
            Handle{" "}
            <span className="text-neutral-600">(used for @mentions)</span>
          </label>
          <input
            id="agent-name"
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Researcher"
            disabled={isEdit}
            required
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </div>

        <div>
          <label htmlFor="agent-display" className={labelClass}>
            Display name{" "}
            <span className="text-neutral-600">(optional)</span>
          </label>
          <input
            id="agent-display"
            type="text"
            value={values.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="Defaults to the handle"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="agent-provider" className={labelClass}>
            Provider
          </label>
          <select
            id="agent-provider"
            value={values.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className={inputClass}
          >
            {AVAILABLE_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="agent-model" className={labelClass}>
            Model
          </label>
          <select
            id="agent-model"
            value={values.model}
            onChange={(e) => set("model", e.target.value)}
            className={inputClass}
          >
            {providerDef.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="agent-role" className={labelClass}>
            Role
          </label>
          <input
            id="agent-role"
            type="text"
            value={values.role}
            onChange={(e) => set("role", e.target.value)}
            placeholder="e.g. Research Analyst"
            required
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="agent-avatar" className={labelClass}>
            Avatar{" "}
            <span className="text-neutral-600">(emoji or image URL, optional)</span>
          </label>
          <input
            id="agent-avatar"
            type="text"
            value={values.avatarUrl}
            onChange={(e) => set("avatarUrl", e.target.value)}
            placeholder="e.g. 🔎 or https://…"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="agent-prompt" className={labelClass}>
            System prompt
          </label>
          <textarea
            id="agent-prompt"
            value={values.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            placeholder="Describe how this agent should behave and what it is responsible for."
            rows={5}
            required
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Create agent"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
