// Agent Registry — the single source of truth for AI providers, their models,
// and the default agent blueprints that ship with every workspace.
//
// This module is intentionally pure (NO database or server-only imports) so it
// can be shared between server route handlers and client components — the agent
// management UI uses it to build provider/model dropdowns, and the server uses
// it to validate input and seed defaults.
//
// HiveMind separates AI *identity* (the teammate the user talks to, e.g. ARi)
// from the underlying *provider/model*. The registry encodes both: the provider
// catalog the system can route to (later phases), and the identity blueprints
// (ARi, Cloudy) used to seed a workspace's starting AI team.
//
// NOTE: external provider APIs are NOT wired up in this phase. The model lists
// here are catalog metadata only — used for selection and display, not for live
// API calls. Provider adapters arrive in a later phase.

/** A selectable model offered by a provider. */
export type ModelOption = {
  /** The id stored on the Agent record and (later) sent to the provider. */
  id: string;
  /** Human-friendly label shown in the UI. */
  label: string;
};

/** A provider HiveMind can host agents on. */
export type ProviderDefinition = {
  /** Stable provider key stored on the Agent record. */
  id: string;
  /** Display label, e.g. "OpenAI (ChatGPT)". */
  label: string;
  /** Short description shown in the management UI. */
  description: string;
  /**
   * Whether agents can currently be created on this provider. Placeholder
   * providers (e.g. Gemini) are listed for visibility but not yet selectable.
   */
  available: boolean;
  /** The model offered by default when creating an agent on this provider. */
  defaultModel: string;
  /** The catalog of models for this provider. */
  models: ModelOption[];
};

// Ordered provider catalog. Order is the display order in the UI.
export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    description: "GPT models. Powers ARi, the builder.",
    available: true,
    defaultModel: "gpt-4o",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    description: "Claude models. Powers Cloudy, the reviewer.",
    available: true,
    defaultModel: "claude-3-5-sonnet-20241022",
    models: [
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Coming soon — listed for visibility, not yet selectable.",
    available: false,
    defaultModel: "gemini-1.5-pro",
    models: [
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
  },
];

/** Providers that agents may currently be created on. */
export const AVAILABLE_PROVIDERS = PROVIDERS.filter((p) => p.available);

/** Looks up a provider definition by id, or undefined if unknown. */
export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** True if the id names a known provider (available or placeholder). */
export function isKnownProvider(id: unknown): id is string {
  return typeof id === "string" && PROVIDERS.some((p) => p.id === id);
}

/** True if the id names a provider agents can currently be created on. */
export function isAvailableProvider(id: unknown): id is string {
  return typeof id === "string" && AVAILABLE_PROVIDERS.some((p) => p.id === id);
}

/** True if `model` is a known model for the given provider. */
export function isModelForProvider(provider: string, model: unknown): boolean {
  const def = getProvider(provider);
  if (!def || typeof model !== "string") return false;
  return def.models.some((m) => m.id === model);
}

/** Human-friendly label for a provider id (falls back to the raw id). */
export function providerLabel(id: string): string {
  return getProvider(id)?.label ?? id;
}

/** Human-friendly label for a model id within a provider (falls back to id). */
export function modelLabel(provider: string, model: string): string {
  const def = getProvider(provider);
  return def?.models.find((m) => m.id === model)?.label ?? model;
}

// --- Default agent blueprints ---------------------------------------------

/**
 * A blueprint for a default agent. Used to seed a workspace's starting AI team.
 * Mirrors the Agent model's user-defined fields (ids/timestamps are generated).
 */
export type AgentBlueprint = {
  name: string;
  displayName: string;
  provider: string;
  model: string;
  role: string;
  systemPrompt: string;
  avatarUrl: string;
};

// The two default teammates every workspace starts with. ARi represents
// OpenAI/ChatGPT; Cloudy represents Anthropic/Claude. Identity is stable even
// if the underlying model is upgraded later.
export const DEFAULT_AGENTS: AgentBlueprint[] = [
  {
    name: "ARi",
    displayName: "ARi",
    provider: "openai",
    model: "gpt-4o",
    role: "System Architect / Programmer",
    systemPrompt:
      "You are ARi, an AI teammate in a HiveMind workspace. You are a system " +
      "architect, programmer, and builder. You turn ideas into concrete plans " +
      "and working solutions: you propose architectures, break work into steps, " +
      "and write or review code. Be direct, practical, and bias toward shipping. " +
      "You collaborate with human teammates and with Cloudy (a deep-reasoning " +
      "review partner). Stay focused on the team's shared goal.",
    avatarUrl: "🤖",
  },
  {
    name: "Cloudy",
    displayName: "Cloudy",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    role: "Deep Reasoning / Review Partner",
    systemPrompt:
      "You are Cloudy, an AI teammate in a HiveMind workspace. You are a " +
      "deep-reasoning and review partner. You think carefully through problems, " +
      "weigh trade-offs, surface risks and edge cases, and review the team's " +
      "plans and work for clarity and correctness. Be thoughtful and honest; " +
      "disagree when warranted. You collaborate with human teammates and with " +
      "ARi (a builder). Stay focused on the team's shared goal.",
    avatarUrl: "☁️",
  },
];
