// Real tokenization via js-tiktoken (pure JS, no WASM).
//
// OpenAI models are exact; Anthropic/Gemini have no lightweight public
// tokenizer, so we approximate them with OpenAI's modern o200k_base encoding —
// far closer than the old chars/4 heuristic. Encoders are cached per encoding.

import { getEncoding, type Tiktoken } from "js-tiktoken";

type EncodingName = "o200k_base" | "cl100k_base";

/** Choose an encoding for a model id. */
function encodingFor(model?: string): EncodingName {
  if (!model) return "o200k_base";
  // Older OpenAI chat models (gpt-4, gpt-3.5, gpt-4-turbo) use cl100k_base.
  if (/^gpt-(4-|4$|3\.5|4-turbo)/.test(model)) return "cl100k_base";
  // gpt-4o / gpt-4.1 / o-series and (approximated) non-OpenAI models.
  return "o200k_base";
}

const encoderCache = new Map<EncodingName, Tiktoken>();

function getEncoder(name: EncodingName): Tiktoken {
  let enc = encoderCache.get(name);
  if (!enc) {
    enc = getEncoding(name);
    encoderCache.set(name, enc);
  }
  return enc;
}

/** Count tokens in a piece of text, using the encoding for the given model. */
export function estimateTokens(
  text: string | null | undefined,
  model?: string,
): number {
  if (!text) return 0;
  return getEncoder(encodingFor(model)).encode(text).length;
}

/** Count tokens across many strings (e.g. a system prompt + messages). */
export function estimateTokensFor(
  parts: Array<string | null | undefined>,
  model?: string,
): number {
  return parts.reduce((sum, p) => sum + estimateTokens(p, model), 0);
}
