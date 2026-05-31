// Discussion validation helpers — pure shaping and validation for multi-agent
// discussions. No database imports, so this can be shared between client
// components and server route handlers (mirrors lib/decisions/validation.ts).
//
// A Discussion is a structured exchange where two or more AI teammates discuss a
// topic over a bounded number of rounds, after which a synthesizer agent
// produces a neutral summary, the points of consensus, and the open
// disagreements. Consensus is stored as a JSON string array; disagreements as a
// JSON array of { point, positions } objects.

const MAX_TOPIC = 500;
const MAX_SUMMARY = 4000;
const MAX_POINT = 400;
const MAX_POSITIONS = 600;
const MAX_CONSENSUS = 20;
const MAX_DISAGREEMENTS = 20;

// A discussion needs at least two participants to be agent-to-agent; more than a
// handful makes each round slow and the synthesis noisy.
export const MIN_AGENTS = 2;
export const MAX_AGENTS = 6;

// Rounds are bounded so a discussion stays focused and provider usage is
// predictable (each round is one provider call per participating agent).
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 4;
export const DEFAULT_ROUNDS = 2;

/** Result of validating raw input: either normalized data or an error. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Normalized fields a client supplies when starting a discussion. */
export type DiscussionStartRequest = {
  /** The room whose agents and context ground the discussion. Required. */
  roomId: string;
  /** What the agents should discuss. Required. */
  topic: string;
  /**
   * Explicit participating agents. When empty the route falls back to the
   * room's active agents. De-duplicated; order preserved.
   */
  agentIds: string[];
  /** How many rounds each agent speaks for. Clamped to [MIN_ROUNDS, MAX_ROUNDS]. */
  rounds: number;
};

/** A single open disagreement surfaced by the synthesizer. */
export type Disagreement = {
  point: string;
  positions: string;
};

/** The synthesis a discussion is persisted with. */
export type DiscussionSynthesis = {
  summary: string;
  consensus: string[];
  disagreements: Disagreement[];
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

/**
 * Validates the request body for POST /api/discussions. roomId and topic are
 * required; agentIds and rounds are optional. workspaceId is validated
 * separately by the route since membership and permission checks need it first.
 */
export function validateDiscussionStart(
  body: unknown
): ValidationResult<DiscussionStartRequest> {
  const b = (body ?? {}) as Record<string, unknown>;

  const roomId = str(b.roomId);
  if (!roomId) {
    return { ok: false, error: "roomId is required." };
  }

  const topic = truncate(str(b.topic), MAX_TOPIC);
  if (!topic) {
    return { ok: false, error: "A discussion topic is required." };
  }

  const agentIds: string[] = [];
  if (Array.isArray(b.agentIds)) {
    const seen = new Set<string>();
    for (const raw of b.agentIds) {
      const id = str(raw);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      agentIds.push(id);
    }
    if (agentIds.length > MAX_AGENTS) {
      return {
        ok: false,
        error: `A discussion can include at most ${MAX_AGENTS} agents.`,
      };
    }
  }

  return { ok: true, data: { roomId, topic, agentIds, rounds: clampRounds(b.rounds) } };
}

/** Clamps an arbitrary rounds value into the supported range. */
export function clampRounds(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : NaN;
  if (!Number.isFinite(n)) return DEFAULT_ROUNDS;
  return Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, Math.trunc(n)));
}

/**
 * Clamps and normalizes a synthesizer's output into safe, bounded fields ready
 * to persist. The AI output is untrusted shape-wise (especially the dev stub or
 * a model that ignores the JSON instruction), so every string is trimmed and
 * truncated and the lists are de-duplicated and capped.
 */
export function coerceSynthesis(input: {
  summary: unknown;
  consensus: unknown;
  disagreements: unknown;
}): DiscussionSynthesis {
  const summary = truncate(str(input.summary), MAX_SUMMARY);

  const consensus: string[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(input.consensus) ? input.consensus : []) {
    const text = truncate(str(raw), MAX_POINT);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    consensus.push(text);
    if (consensus.length >= MAX_CONSENSUS) break;
  }

  const disagreements: Disagreement[] = [];
  for (const raw of Array.isArray(input.disagreements) ? input.disagreements : []) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const point = truncate(str(obj.point), MAX_POINT);
    if (!point) continue;
    const positions = truncate(str(obj.positions), MAX_POSITIONS);
    disagreements.push({ point, positions });
    if (disagreements.length >= MAX_DISAGREEMENTS) break;
  }

  return { summary, consensus, disagreements };
}

/** Serializes consensus points for storage; null when there are none. */
export function serializeConsensus(consensus: string[]): string | null {
  return consensus.length > 0 ? JSON.stringify(consensus) : null;
}

/** Serializes disagreements for storage; null when there are none. */
export function serializeDisagreements(
  disagreements: Disagreement[]
): string | null {
  return disagreements.length > 0 ? JSON.stringify(disagreements) : null;
}

/** Parses stored consensus JSON back into a string array, tolerating bad data. */
export function parseConsensus(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Parses stored disagreements JSON back into objects, tolerating bad data. */
export function parseDisagreements(raw: string | null): Disagreement[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Disagreement[] = [];
    for (const item of parsed) {
      const obj = (item ?? {}) as Record<string, unknown>;
      const point = typeof obj.point === "string" ? obj.point : "";
      if (!point) continue;
      out.push({
        point,
        positions: typeof obj.positions === "string" ? obj.positions : "",
      });
    }
    return out;
  } catch {
    return [];
  }
}
