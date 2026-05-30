// Project context validation helpers — pure shaping and validation.
//
// ProjectContext holds a workspace's stable identity and mission: who the team
// is, what they're building, the non-negotiables. The architecture treats it as
// DISTINCT from memory and HIGHER priority — it goes first in every agent's
// system prompt, before curated memory. This module has NO database imports so
// it can be shared between client forms and server route handlers.

const MAX_TITLE = 120;
const MAX_CONTENT = 4000;

/** Result of validating raw input: either normalized data or an error. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Normalized, validated fields for creating a project context entry. */
export type ProjectContextCreateInput = {
  title: string;
  content: string;
};

/** Fields that may be changed on an existing project context entry. */
export type ProjectContextUpdateInput = Partial<{
  title: string;
  content: string;
}>;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates and normalizes raw input for creating a project context entry.
 * Both title and content are required — an entry with no content carries no
 * signal into the agent prompt.
 */
export function validateProjectContextCreate(
  body: unknown
): ValidationResult<ProjectContextCreateInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  const title = str(b.title);
  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  if (title.length > MAX_TITLE) {
    return { ok: false, error: "Title is too long." };
  }

  const content = str(b.content);
  if (!content) {
    return { ok: false, error: "Content is required." };
  }
  if (content.length > MAX_CONTENT) {
    return { ok: false, error: "Content is too long." };
  }

  return { ok: true, data: { title, content } };
}

/**
 * Validates a partial update. Only provided fields are included in the result.
 */
export function validateProjectContextUpdate(
  body: unknown
): ValidationResult<ProjectContextUpdateInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: ProjectContextUpdateInput = {};

  if (b.title !== undefined) {
    const title = str(b.title);
    if (!title) {
      return { ok: false, error: "Title cannot be empty." };
    }
    if (title.length > MAX_TITLE) {
      return { ok: false, error: "Title is too long." };
    }
    data.title = title;
  }

  if (b.content !== undefined) {
    const content = str(b.content);
    if (!content) {
      return { ok: false, error: "Content cannot be empty." };
    }
    if (content.length > MAX_CONTENT) {
      return { ok: false, error: "Content is too long." };
    }
    data.content = content;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, data };
}
