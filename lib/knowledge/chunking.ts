// Chunking service (Phase 11 — Knowledge & RAG).
//
// Splits an ingested document or text block into bounded, overlapping chunks
// suitable for embedding and retrieval. Pure — no DB or network imports — so it
// can be unit-tested and reused anywhere. Two goals shape the algorithm:
//
//   1. Respect natural boundaries. Splitting mid-sentence hurts both embedding
//      quality and the readability of retrieved passages, so we accumulate whole
//      paragraphs/sentences up to a size budget rather than slicing blindly.
//   2. Keep chunks self-contained. A small overlap carries the tail of one chunk
//      into the next so a fact spanning a boundary is still retrievable from at
//      least one chunk.

// Target maximum characters per chunk (~250-400 tokens). A single paragraph or
// sentence longer than this is hard-split so no chunk exceeds the budget by much.
export const DEFAULT_CHUNK_SIZE = 1000;
// Characters of trailing context repeated at the start of the next chunk.
export const DEFAULT_CHUNK_OVERLAP = 150;

export type ChunkOptions = {
  maxChars?: number;
  overlap?: number;
};

/**
 * Splits text into overlapping chunks. Returns trimmed, non-empty chunks in
 * document order. An empty/blank input yields an empty array.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_CHUNK_SIZE);
  const overlap = Math.max(
    0,
    Math.min(options.overlap ?? DEFAULT_CHUNK_OVERLAP, maxChars - 1)
  );

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Break into atomic segments (paragraphs, then over-long paragraphs into
  // sentences, then any still-too-long segment hard-split) that never exceed the
  // budget, so the greedy packer below can always place one.
  const segments = splitIntoSegments(normalized, maxChars);

  const chunks: string[] = [];
  let current = "";

  for (const segment of segments) {
    if (!current) {
      current = segment;
      continue;
    }
    if (current.length + 1 + segment.length <= maxChars) {
      current = `${current}\n${segment}`;
    } else {
      chunks.push(current);
      // Seed the next chunk with the overlap tail of the one just closed.
      const tail = overlap > 0 ? current.slice(-overlap).trimStart() : "";
      current = tail ? `${tail}\n${segment}` : segment;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((c) => c.trim()).filter(Boolean);
}

// Produces segments no longer than maxChars, preferring paragraph then sentence
// boundaries and hard-splitting only when a single unit is still too long.
function splitIntoSegments(text: string, maxChars: number): string[] {
  const segments: string[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxChars) {
      segments.push(trimmed);
      continue;
    }
    for (const sentence of splitSentences(trimmed)) {
      if (sentence.length <= maxChars) {
        segments.push(sentence);
      } else {
        segments.push(...hardSplit(sentence, maxChars));
      }
    }
  }
  return segments;
}

function splitSentences(text: string): string[] {
  // Split after sentence-ending punctuation followed by whitespace. Keeps the
  // punctuation with its sentence.
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hardSplit(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    parts.push(text.slice(i, i + maxChars).trim());
  }
  return parts.filter(Boolean);
}
