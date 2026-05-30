// Decision validation helpers — pure shaping and validation for decision
// summaries. No database imports, so this can be shared between client
// components and server route handlers (mirrors lib/memory/validation.ts).
//
// A Decision is an AI-generated summary of what a team decided in a room: a
// short title, a 1–3 sentence summary, and an optional list of action items.
// It is produced from recent room messages via the AI Router and persisted in
// the existing Decision model (actionItems stored as a JSON string array).

const MAX_TITLE = 120;
const MAX_SUMMARY = 4000;
const MAX_ACTION_ITEMS = 20;
const MAX_ACTION_ITEM = 300;

/** Result of validating raw input: either normalized data or an error. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Normalized fields a client supplies when requesting a decision summary. */
export type DecisionSummaryRequest = {
  /** The room whose recent messages are summarized. Required. */
  roomId: string;
  /** Optional agent to author the summary; null falls back to a default agent. */
  agentId: string | null;
};

/** The fields a Decision is persisted with (action items pre-serialized). */
export type DecisionFields = {
  title: string;
  summary: string;
  actionItems: string[];
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates the request body for POST /api/summaries/decision. A roomId is
 * required (a summary is always generated from one room's messages); agentId is
 * optional. workspaceId is validated separately by the route since membership
 * and permission checks need it first.
 */
export function validateDecisionSummaryRequest(
  body: unknown
): ValidationResult<DecisionSummaryRequest> {
  const b = (body ?? {}) as Record<string, unknown>;

  const roomId = str(b.roomId);
  if (!roomId) {
    return { ok: false, error: "roomId is required." };
  }

  const agentId = str(b.agentId);

  return { ok: true, data: { roomId, agentId: agentId || null } };
}

/**
 * Clamps and normalizes a generated decision into safe, bounded fields ready to
 * persist. The AI output is untrusted shape-wise (especially the dev stub or a
 * model that ignores the JSON instruction), so title/summary are trimmed and
 * truncated and action items are de-duplicated and capped.
 */
export function coerceDecisionFields(input: {
  title: unknown;
  summary: unknown;
  actionItems: unknown;
}): DecisionFields {
  const title = truncate(str(input.title), MAX_TITLE) || "Decision summary";
  const summary = truncate(str(input.summary), MAX_SUMMARY);

  const rawItems = Array.isArray(input.actionItems) ? input.actionItems : [];
  const seen = new Set<string>();
  const actionItems: string[] = [];
  for (const item of rawItems) {
    const text = truncate(str(item), MAX_ACTION_ITEM);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    actionItems.push(text);
    if (actionItems.length >= MAX_ACTION_ITEMS) break;
  }

  return { title, summary, actionItems };
}

/** Serializes action items for storage; null when there are none. */
export function serializeActionItems(actionItems: string[]): string | null {
  return actionItems.length > 0 ? JSON.stringify(actionItems) : null;
}

/**
 * Parses the stored actionItems JSON string back into an array, tolerating
 * null, malformed JSON, or non-array values (always returns string[]).
 */
export function parseActionItems(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}
