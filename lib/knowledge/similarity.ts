// Vector similarity helpers for knowledge retrieval (Phase 11).
//
// SQLite has no native vector type, so embeddings are stored as JSON arrays and
// compared in-process. These helpers are pure and tiny — the cost is bounded by
// the MVP's per-workspace chunk counts (no ANN index needed at this scale).

/**
 * Cosine similarity of two equal-length vectors, in [-1, 1]. Returns 0 for
 * mismatched lengths or a zero-magnitude vector so callers never divide by zero
 * or compare incompatible embeddings (e.g. local 256-dim vs OpenAI 1536-dim).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Parses a stored JSON embedding back into a number[]; returns null if malformed. */
export function parseEmbedding(json: string): number[] | null {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
