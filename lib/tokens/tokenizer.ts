// Lightweight tokenization estimate.
//
// We don't ship a full BPE tokenizer for the MVP — a ~4-characters-per-token
// heuristic is accurate enough to drive the budget meter and per-call usage
// logging, and it works identically for every provider with zero dependencies.

const CHARS_PER_TOKEN = 4;

/** Estimate the number of tokens in a piece of text. */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimate tokens across many strings (e.g. a system prompt + messages). */
export function estimateTokensFor(...parts: Array<string | null | undefined>): number {
  return parts.reduce((sum, p) => sum + estimateTokens(p), 0);
}
