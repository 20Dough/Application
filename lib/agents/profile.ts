// Agent profile helpers — pure shaping and validation for AI agent identities.
//
// An "agent profile" is the full, user-facing identity of an AI teammate:
// handle (name), display name, provider/model, role, system prompt, avatar, and
// active status. This module has NO database imports so it can be used by both
// client components (forms, profile cards) and server route handlers (input
// validation).
//
// The registry (lib/agents/registry.ts) owns the provider/model catalog; this
// module owns the rules for a valid agent and the presentation helpers (avatar
// initials and colors) shared across the UI.

import {
  isAvailableProvider,
  isModelForProvider,
  getProvider,
} from "@/lib/agents/registry";

// An agent handle is used for @mentions, so keep it simple and unambiguous:
// letters, numbers, underscore and hyphen, no spaces. 1–32 chars.
const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;

const MAX_DISPLAY_NAME = 60;
const MAX_ROLE = 80;
const MAX_SYSTEM_PROMPT = 8000;

/** Normalized, validated fields for creating an agent. */
export type AgentCreateInput = {
  name: string;
  displayName: string;
  provider: string;
  model: string;
  role: string;
  systemPrompt: string;
  avatarUrl: string | null;
};

/** Result of validating raw input: either normalized data or field errors. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates and normalizes raw input for creating a new agent. The display name
 * defaults to the handle when omitted. Provider must be currently available and
 * the model must belong to it.
 */
export function validateAgentCreate(
  body: unknown
): ValidationResult<AgentCreateInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  const name = str(b.name);
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      error:
        "Name must be 1–32 characters: letters, numbers, hyphens or underscores (no spaces).",
    };
  }

  const displayName = str(b.displayName) || name;
  if (displayName.length > MAX_DISPLAY_NAME) {
    return { ok: false, error: "Display name is too long." };
  }

  const provider = str(b.provider);
  if (!isAvailableProvider(provider)) {
    return { ok: false, error: "Choose a valid, available provider." };
  }

  // Default to the provider's default model when none is supplied.
  const model = str(b.model) || getProvider(provider)!.defaultModel;
  if (!isModelForProvider(provider, model)) {
    return { ok: false, error: "Choose a valid model for this provider." };
  }

  const role = str(b.role);
  if (!role) {
    return { ok: false, error: "Role is required." };
  }
  if (role.length > MAX_ROLE) {
    return { ok: false, error: "Role is too long." };
  }

  const systemPrompt = str(b.systemPrompt);
  if (!systemPrompt) {
    return { ok: false, error: "System prompt is required." };
  }
  if (systemPrompt.length > MAX_SYSTEM_PROMPT) {
    return { ok: false, error: "System prompt is too long." };
  }

  const avatarRaw = str(b.avatarUrl);

  return {
    ok: true,
    data: {
      name,
      displayName,
      provider,
      model,
      role,
      systemPrompt,
      avatarUrl: avatarRaw || null,
    },
  };
}

/** Fields that may be changed on an existing agent. */
export type AgentUpdateInput = Partial<
  Pick<
    AgentCreateInput,
    "displayName" | "provider" | "model" | "role" | "systemPrompt" | "avatarUrl"
  >
> & { isActive?: boolean };

/**
 * Validates a partial update. Only provided fields are included in the result.
 * The agent handle (name) is immutable because it anchors @mentions, so it is
 * intentionally not updatable here. When the provider changes, a matching model
 * must be supplied in the same request.
 */
export function validateAgentUpdate(
  body: unknown
): ValidationResult<AgentUpdateInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: AgentUpdateInput = {};

  if (b.displayName !== undefined) {
    const displayName = str(b.displayName);
    if (!displayName) {
      return { ok: false, error: "Display name cannot be empty." };
    }
    if (displayName.length > MAX_DISPLAY_NAME) {
      return { ok: false, error: "Display name is too long." };
    }
    data.displayName = displayName;
  }

  // Provider and model are validated together so the pair stays consistent.
  if (b.provider !== undefined || b.model !== undefined) {
    const provider = str(b.provider);
    if (!isAvailableProvider(provider)) {
      return { ok: false, error: "Choose a valid, available provider." };
    }
    const model = str(b.model) || getProvider(provider)!.defaultModel;
    if (!isModelForProvider(provider, model)) {
      return { ok: false, error: "Choose a valid model for this provider." };
    }
    data.provider = provider;
    data.model = model;
  }

  if (b.role !== undefined) {
    const role = str(b.role);
    if (!role) return { ok: false, error: "Role cannot be empty." };
    if (role.length > MAX_ROLE) {
      return { ok: false, error: "Role is too long." };
    }
    data.role = role;
  }

  if (b.systemPrompt !== undefined) {
    const systemPrompt = str(b.systemPrompt);
    if (!systemPrompt) {
      return { ok: false, error: "System prompt cannot be empty." };
    }
    if (systemPrompt.length > MAX_SYSTEM_PROMPT) {
      return { ok: false, error: "System prompt is too long." };
    }
    data.systemPrompt = systemPrompt;
  }

  if (b.avatarUrl !== undefined) {
    data.avatarUrl = str(b.avatarUrl) || null;
  }

  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") {
      return { ok: false, error: "isActive must be a boolean." };
    }
    data.isActive = b.isActive;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, data };
}

// --- Presentation helpers (avatar) ----------------------------------------

// Deterministic accent palette for agent avatars when no image is set. The
// color is derived from the agent name so an agent looks consistent everywhere.
const AVATAR_COLORS = [
  "bg-sky-900/60 text-sky-200",
  "bg-emerald-900/60 text-emerald-200",
  "bg-violet-900/60 text-violet-200",
  "bg-amber-900/60 text-amber-200",
  "bg-rose-900/60 text-rose-200",
  "bg-cyan-900/60 text-cyan-200",
];

/** Stable accent classes for an agent's fallback avatar, keyed by name. */
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Up to two initials for an agent's fallback avatar. */
export function avatarInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** True if the avatar value is an image URL (vs. an emoji/text glyph). */
export function isImageAvatar(avatarUrl: string | null | undefined): boolean {
  return (
    typeof avatarUrl === "string" && /^(https?:)?\/\//.test(avatarUrl.trim())
  );
}
