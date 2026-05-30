// Knowledge validation helpers (Phase 11 — Knowledge & RAG).
//
// A KnowledgeSource is a document or block of text added to a workspace's
// knowledge base; on ingestion it is chunked and embedded so the AI Router can
// retrieve relevant passages. This module is pure (NO database imports) so it
// can be shared between client forms and server route handlers, mirroring
// lib/memory/validation.ts. Room-scope ownership (does this room belong to the
// workspace?) is checked in the route where the database is available.

const MAX_TITLE = 200;
// Documents can be large; cap generously so a long page/spec is accepted but a
// pasted megabyte that would explode chunk counts is rejected with a clear error.
const MAX_CONTENT = 200_000;
const MIN_CONTENT = 1;

export const SOURCE_TYPES = ["text", "document"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const DEFAULT_SOURCE_TYPE: SourceType = "text";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Normalized, validated fields for creating a knowledge source. */
export type KnowledgeCreateInput = {
  title: string;
  content: string;
  sourceType: SourceType;
  roomId: string | null;
};

/** Fields that may be changed on an existing source's metadata (not its content). */
export type KnowledgeUpdateInput = Partial<{
  title: string;
  roomId: string | null;
}>;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && (SOURCE_TYPES as readonly string[]).includes(value);
}

/**
 * Validates raw input for creating a knowledge source. Title and content are
 * required; sourceType defaults to "text" and must be a known type; roomId is
 * optional and normalized to null when blank.
 */
export function validateKnowledgeCreate(
  body: unknown
): ValidationResult<KnowledgeCreateInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  const title = str(b.title);
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > MAX_TITLE) return { ok: false, error: "Title is too long." };

  const content = str(b.content);
  if (content.length < MIN_CONTENT) {
    return { ok: false, error: "Content is required." };
  }
  if (content.length > MAX_CONTENT) {
    return {
      ok: false,
      error: `Content is too large (limit ${MAX_CONTENT.toLocaleString()} characters).`,
    };
  }

  let sourceType: SourceType = DEFAULT_SOURCE_TYPE;
  if (b.sourceType !== undefined && b.sourceType !== null && b.sourceType !== "") {
    if (!isSourceType(b.sourceType)) {
      return { ok: false, error: "Unknown source type." };
    }
    sourceType = b.sourceType;
  }

  const roomId = str(b.roomId);

  return { ok: true, data: { title, content, sourceType, roomId: roomId || null } };
}

/**
 * Validates a partial metadata update. Only provided fields are returned.
 * Content is intentionally not editable here — changing it would require
 * re-chunking and re-embedding, which is done by deleting and re-adding a source.
 */
export function validateKnowledgeUpdate(
  body: unknown
): ValidationResult<KnowledgeUpdateInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: KnowledgeUpdateInput = {};

  if (b.title !== undefined) {
    const title = str(b.title);
    if (!title) return { ok: false, error: "Title cannot be empty." };
    if (title.length > MAX_TITLE) return { ok: false, error: "Title is too long." };
    data.title = title;
  }

  if (b.roomId !== undefined) {
    data.roomId = str(b.roomId) || null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, data };
}
