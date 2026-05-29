// Room validation helpers — pure shaping and validation for discussion rooms.
//
// A "room" is a focused discussion space inside a workspace. This module owns
// the rules for a valid room (name, description) and has NO database imports,
// so it can be shared between client components (forms) and server route
// handlers (input validation) — mirroring lib/agents/profile.ts.

const MAX_NAME = 80;
const MAX_DESCRIPTION = 500;

/** Result of validating raw input: either normalized data or an error. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Normalized, validated fields for creating a room. */
export type RoomCreateInput = {
  name: string;
  description: string | null;
};

/** Fields that may be changed on an existing room. */
export type RoomUpdateInput = Partial<{
  name: string;
  description: string | null;
}>;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates and normalizes raw input for creating a new room. The name is
 * required; the description is optional and normalized to null when empty.
 */
export function validateRoomCreate(
  body: unknown
): ValidationResult<RoomCreateInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  const name = str(b.name);
  if (!name) {
    return { ok: false, error: "Room name is required." };
  }
  if (name.length > MAX_NAME) {
    return { ok: false, error: "Room name is too long." };
  }

  const description = str(b.description);
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, error: "Description is too long." };
  }

  return {
    ok: true,
    data: { name, description: description || null },
  };
}

/**
 * Validates a partial update. Only provided fields are included in the result.
 * Setting the default agent is handled separately by the route (it needs the
 * database to confirm the agent is a member of the room), so it is intentionally
 * not part of this pure validator.
 */
export function validateRoomUpdate(
  body: unknown
): ValidationResult<RoomUpdateInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: RoomUpdateInput = {};

  if (b.name !== undefined) {
    const name = str(b.name);
    if (!name) {
      return { ok: false, error: "Room name cannot be empty." };
    }
    if (name.length > MAX_NAME) {
      return { ok: false, error: "Room name is too long." };
    }
    data.name = name;
  }

  if (b.description !== undefined) {
    const description = str(b.description);
    if (description.length > MAX_DESCRIPTION) {
      return { ok: false, error: "Description is too long." };
    }
    data.description = description || null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, data };
}
