// Memory validation helpers — pure shaping and validation for shared memory.
//
// A MemoryItem is a curated, long-term fact the AI team should keep in mind
// (decisions of record, constraints, glossary terms, preferences). Importance
// ranks items so the context builder can keep the most relevant ones when the
// budget is tight. Memory may be workspace-wide (roomId null) or scoped to one
// room. This module has NO database imports so it can be shared between client
// forms and server route handlers — mirroring lib/rooms/validation.ts.

const MAX_TITLE = 120;
const MAX_CONTENT = 4000;

// Importance is a small, bounded scale so the UI and context builder agree on
// what "high" means. 0 = background, 5 = critical.
export const MIN_IMPORTANCE = 0;
export const MAX_IMPORTANCE = 5;
export const DEFAULT_IMPORTANCE = 1;

/** Result of validating raw input: either normalized data or an error. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Normalized, validated fields for creating a memory item. */
export type MemoryCreateInput = {
  title: string;
  content: string;
  importance: number;
  roomId: string | null;
};

/** Fields that may be changed on an existing memory item. */
export type MemoryUpdateInput = Partial<{
  title: string;
  content: string;
  importance: number;
  roomId: string | null;
}>;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Accepts numbers or numeric strings (forms submit strings), clamped to the
// allowed range. Returns null when the value is missing/blank so callers can
// fall back to a default; returns NaN-guarded errors for genuinely bad input.
function parseImportance(
  value: unknown
): { ok: true; value: number } | { ok: false } | { ok: "absent" } {
  if (value === undefined || value === null || value === "") {
    return { ok: "absent" };
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return { ok: false };
  const clamped = Math.min(MAX_IMPORTANCE, Math.max(MIN_IMPORTANCE, Math.round(n)));
  return { ok: true, value: clamped };
}

/**
 * Validates and normalizes raw input for creating a memory item. Title and
 * content are required. Importance defaults when absent and is clamped to range.
 * roomId is optional and normalized to null when empty; the route confirms the
 * room actually belongs to the workspace (that check needs the database).
 */
export function validateMemoryCreate(
  body: unknown
): ValidationResult<MemoryCreateInput> {
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

  const importance = parseImportance(b.importance);
  if (importance.ok === false) {
    return { ok: false, error: "Importance must be a number." };
  }

  const roomId = str(b.roomId);

  return {
    ok: true,
    data: {
      title,
      content,
      importance: importance.ok === true ? importance.value : DEFAULT_IMPORTANCE,
      roomId: roomId || null,
    },
  };
}

/**
 * Validates a partial update. Only provided fields are included in the result.
 * Passing roomId: null (or "") clears the room scope, making the item
 * workspace-wide.
 */
export function validateMemoryUpdate(
  body: unknown
): ValidationResult<MemoryUpdateInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: MemoryUpdateInput = {};

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

  if (b.importance !== undefined) {
    const importance = parseImportance(b.importance);
    if (importance.ok === false) {
      return { ok: false, error: "Importance must be a number." };
    }
    // Treat an explicit blank as "reset to default" rather than an error.
    data.importance =
      importance.ok === true ? importance.value : DEFAULT_IMPORTANCE;
  }

  if (b.roomId !== undefined) {
    data.roomId = str(b.roomId) || null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, data };
}
