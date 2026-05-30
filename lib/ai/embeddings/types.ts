// Embedding provider abstraction (Phase 11 — Knowledge & RAG).
//
// Mirrors the chat provider abstraction (lib/ai/types.ts): one common interface,
// concrete adapters, and a factory. The knowledge ingestion and retrieval
// services embed text through this interface only — they never construct an
// adapter or call an external embedding API directly. Adding a new embedding
// backend means implementing EmbeddingProvider and registering it in the factory.

/** The common interface every embedding backend implements. */
export interface EmbeddingProvider {
  /** Stable id recorded on each chunk (e.g. "openai:text-embedding-3-small", "local-hash"). */
  readonly id: string;
  /** Fixed output dimensionality. All vectors this provider returns share this length. */
  readonly dimensions: number;
  /**
   * Embeds a batch of texts, returning one vector per input (same order).
   * Throws on failure; callers decide whether to degrade gracefully.
   */
  embed(texts: string[]): Promise<number[][]>;
}
