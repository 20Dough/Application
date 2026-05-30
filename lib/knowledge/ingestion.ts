import { db } from "@/lib/db";
import type { KnowledgeSource } from "@prisma/client";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { chunkText } from "@/lib/knowledge/chunking";
import type { SourceType } from "@/lib/knowledge/validation";

// Knowledge ingestion service (Phase 11 — Knowledge & RAG).
//
// Turns a block of document/text into a persisted, retrievable KnowledgeSource:
//
//   chunk the content → embed every chunk → persist the source + its chunks.
//
// Ingestion is synchronous in the MVP (no background queue): the POST route
// awaits this and returns the finished source. Embedding goes through the
// provider factory, so it uses OpenAI when a key is set and the local
// deterministic provider otherwise — keeping ingestion working offline and in
// tests. The route owns auth, permissions, and room-scope validation; this
// service owns the chunk/embed/persist pipeline.

/** Raised for an ingestion failure the caller should surface (e.g. empty content). */
export class KnowledgeIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeIngestionError";
  }
}

export type IngestInput = {
  workspaceId: string;
  roomId: string | null;
  title: string;
  sourceType: SourceType;
  content: string;
};

/**
 * Chunks, embeds, and persists a knowledge source and all of its chunks in a
 * single transaction. The source's charCount/chunkCount are recorded for the UI.
 * Throws KnowledgeIngestionError when the content produces no usable chunks;
 * embedding/database failures propagate to the route's generic 500 handling.
 */
export async function ingestKnowledgeSource(
  input: IngestInput
): Promise<KnowledgeSource> {
  const chunks = chunkText(input.content);
  if (chunks.length === 0) {
    throw new KnowledgeIngestionError("The content has no usable text to ingest.");
  }

  const provider = getEmbeddingProvider();
  const embeddings = await provider.embed(chunks);
  if (embeddings.length !== chunks.length) {
    throw new KnowledgeIngestionError("Embedding failed to cover all chunks.");
  }

  // Create the source and its chunks atomically so a partially-embedded source
  // never appears in retrieval.
  return db.$transaction(async (tx) => {
    const source = await tx.knowledgeSource.create({
      data: {
        workspaceId: input.workspaceId,
        roomId: input.roomId,
        title: input.title,
        sourceType: input.sourceType,
        status: "ready",
        charCount: input.content.length,
        chunkCount: chunks.length,
      },
    });

    await tx.knowledgeChunk.createMany({
      data: chunks.map((content, i) => ({
        sourceId: source.id,
        workspaceId: input.workspaceId,
        roomId: input.roomId,
        chunkIndex: i,
        content,
        embedding: JSON.stringify(embeddings[i]),
        embeddingModel: provider.id,
        dimensions: provider.dimensions,
      })),
    });

    return source;
  });
}
