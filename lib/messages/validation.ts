// Message validation helpers — pure shaping and validation for chat messages.
//
// A "message" is a single chat entry inside a room. This module owns the rules
// for a valid human message (non-empty content within a length limit) and has
// NO database imports, so it can be shared between client components (the
// message input) and server route handlers (input validation) — mirroring
// lib/rooms/validation.ts.

const MAX_CONTENT = 4000;

/** Result of validating raw input: either normalized data or an error. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Normalized, validated fields for creating a human message. */
export type MessageCreateInput = {
  content: string;
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates and normalizes raw input for posting a human message. Content is
 * required (non-empty after trimming) and capped at MAX_CONTENT characters.
 */
export function validateMessageCreate(
  body: unknown
): ValidationResult<MessageCreateInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  const content = str(b.content);
  if (!content) {
    return { ok: false, error: "Message cannot be empty." };
  }
  if (content.length > MAX_CONTENT) {
    return { ok: false, error: "Message is too long." };
  }

  return { ok: true, data: { content } };
}
