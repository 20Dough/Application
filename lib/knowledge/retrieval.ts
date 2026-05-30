import { db } from "@/lib/db";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { cosineSimilarity, parseEmbedding } from "@/lib/knowledge/similarity";

// Knowledge retrieval service (Phase 11 — Knowledge & RAG).
//
// Given a query (typically the latest human message) and a scope, returns the
// most relevant knowledge chunks so the AI Router can inject them into an
// agent's context. Scope mirrors memory: workspace-wide chunks (roomId null)
// are always eligible; when a roomId is given, that room's chunks are eligible
// too, so room-specific knowledge never leaks into other rooms.
//
// SQLite has no vector index, so we embed the query, load the candidate chunks
// for the scope, and rank by cosine similarity in-process. At MVP chunk counts
// this is cheap. Chunks whose embedding dimension differs from the live query
// embedding (e.g. indexed with the local provider, queried after switching to
// OpenAI) are skipped so incompatible vectors never produce misleading scores.

// Defaults tuned for prompt budget: a handful of focused passages, not a dump.
export const DEFAULT_TOP_K = 4;
// Cosine floor below which a passage is considered irrelevant and dropped. The
// local hashed-bag-of-words provider produces lower scores than a semantic model,
// so this is deliberately permissive; it mainly filters out near-zero matches.
export const DEFAULT_MIN_SCORE = 0.05;
// Cap on candidates scored in-process, so a huge knowledge base can't blow up a
// single chat request. Newest sources win when truncated.
const MAX_CANDIDATES = 500;

export type RetrievedChunk = {
  sourceId: string;
  sourceTitle: string;
  content: string;
  score: number;
};

export type RetrieveOptions = {
  workspaceId: string;
  roomId?: string | null;
  query: string;
  topK?: number;
  minScore?: number;
};

/**
 * Retrieves the top-K knowledge chunks most relevant to the query within the
 * given scope, ranked by cosine similarity and filtered by a minimum score.
 * Returns [] when the query is blank or no knowledge exists. Never throws for an
 * empty knowledge base; embedding errors propagate to the caller, which (in the
 * router) degrades gracefully.
 */
export async function retrieveKnowledge(
  options: RetrieveOptions
): Promise<RetrievedChunk[]> {
  const query = options.query.trim();
  if (!query) return [];

  const topK = Math.max(1, options.topK ?? DEFAULT_TOP_K);
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const roomFilter =
    options.roomId != null
      ? [{ roomId: null }, { roomId: options.roomId }]
      : [{ roomId: null }];

  const candidates = await db.knowledgeChunk.findMany({
    where: { workspaceId: options.workspaceId, OR: roomFilter },
    select: {
      sourceId: true,
      content: true,
      embedding: true,
      dimensions: true,
      source: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
  });
  if (candidates.length === 0) return [];

  const provider = getEmbeddingProvider();
  const [queryEmbedding] = await provider.embed([query]);

  const scored: RetrievedChunk[] = [];
  for (const chunk of candidates) {
    // Skip chunks embedded at a different dimension than the live query.
    if (chunk.dimensions !== queryEmbedding.length) continue;
    const embedding = parseEmbedding(chunk.embedding);
    if (!embedding) continue;
    const score = cosineSimilarity(queryEmbedding, embedding);
    if (score < minScore) continue;
    scored.push({
      sourceId: chunk.sourceId,
      sourceTitle: chunk.source.title,
      content: chunk.content,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
