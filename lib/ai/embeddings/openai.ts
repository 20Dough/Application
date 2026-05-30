import OpenAI from "openai";
import type { EmbeddingProvider } from "@/lib/ai/embeddings/types";

// OpenAI embedding adapter. Used when OPENAI_API_KEY is configured; otherwise
// the factory falls back to the local deterministic provider so the knowledge
// feature works offline. The API key is read server-side only and never exposed
// to the client (all embedding happens in route handlers / the AI Router).

// text-embedding-3-small is inexpensive and returns 1536-dim vectors. The model
// id is part of the provider id recorded on each chunk so retrieval can detect a
// model change and skip incompatible vectors.
const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = `openai:${MODEL}`;
  readonly dimensions = DIMENSIONS;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: MODEL,
      input: texts,
    });
    // The API preserves input order; map back to a plain number[][].
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding as number[]);
  }
}
