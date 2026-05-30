import type { EmbeddingProvider } from "@/lib/ai/embeddings/types";

// Local, deterministic embedding provider.
//
// Knowledge ingestion and retrieval must work locally and in automated runtime
// tests WITHOUT an embedding API key or network access — just like the chat
// StubProvider keeps the collaboration loop working without secrets. This
// provider produces a fixed-dimension vector from a piece of text using a
// hashed bag-of-words: each token is hashed into a bucket and its (sublinear)
// frequency accumulated, then the vector is L2-normalized.
//
// The result is fully deterministic and offline, and — crucially — yields
// meaningful cosine similarity: texts that share vocabulary point in similar
// directions, so retrieval returns sensibly ranked passages. It is not a
// semantic model; setting OPENAI_API_KEY swaps in real embeddings via the
// factory with no other code changes.

const DEFAULT_DIMENSIONS = 256;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = "local-hash";
  readonly dimensions: number;

  constructor(dimensions: number = DEFAULT_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = tokenize(text);

    // Term-frequency accumulation into hashed buckets. A second hash decides the
    // sign so distinct tokens that collide into the same bucket don't always add
    // constructively (a standard feature-hashing trick that reduces collision bias).
    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }

    for (const [token, count] of counts) {
      const bucket = hash(token) % this.dimensions;
      const sign = hash(`${token}#sign`) % 2 === 0 ? 1 : -1;
      // Sublinear term weighting so a few very frequent tokens don't dominate.
      vector[bucket] += sign * (1 + Math.log(count));
    }

    return normalize(vector);
  }
}

// Lowercase alphanumeric word tokens; everything else is a separator. Good
// enough to align vocabulary between a query and the chunks it should match.
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

// FNV-1a — a small, fast, well-distributed non-cryptographic string hash.
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned so the modulo lands in [0, dimensions).
  return h >>> 0;
}

function normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const v of vector) sumSquares += v * v;
  const magnitude = Math.sqrt(sumSquares);
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}
