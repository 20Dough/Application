import type { EmbeddingProvider } from "@/lib/ai/embeddings/types";
import { OpenAIEmbeddingProvider } from "./openai";
import { LocalEmbeddingProvider } from "./local";

// Embedding provider factory — the single place that decides which embedding
// backend powers knowledge ingestion and retrieval.
//
// Resolution rules:
//   - OPENAI_API_KEY set → real OpenAI embeddings (semantic quality).
//   - No key            → the local deterministic provider, so the knowledge
//                          feature still works with no secrets or network. This
//                          differs from the chat factory (which throws in
//                          production without a key) on purpose: retrieval should
//                          degrade to lexical similarity rather than disable
//                          knowledge entirely or break the chat loop.
//
// The same provider must embed both stored chunks and the live query for cosine
// similarity to be meaningful. Each chunk records the provider id and dimension
// it was embedded with; retrieval skips chunks whose dimension differs from the
// current query embedding (e.g. after switching from local → OpenAI), so mixed
// vectors never produce garbage scores. Re-ingesting a source re-embeds it with
// the current provider.

let cached: EmbeddingProvider | null = null;
let cachedKeyPresent: boolean | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  const keyPresent = Boolean(process.env.OPENAI_API_KEY?.trim());

  // Rebuild only when the key's presence changes (cheap, and keeps tests that
  // toggle env vars honest); otherwise reuse the instance.
  if (cached && cachedKeyPresent === keyPresent) {
    return cached;
  }

  cached = keyPresent
    ? new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY!.trim())
    : new LocalEmbeddingProvider();
  cachedKeyPresent = keyPresent;
  return cached;
}

export type { EmbeddingProvider } from "@/lib/ai/embeddings/types";
