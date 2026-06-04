// Model catalog — the set of AI models users can choose from, grouped by
// provider. Pure data + helpers (no DB / no server-only imports) so this can be
// imported from client components (the agent editor) and the server alike.
//
// `costPer1k` is a relative credit weight used for two things:
//   1. picking the cheapest active agent as the "router" that decides who answers
//   2. estimating token spend per call
// `tokenLimit` is each model's share of a workspace's pool — when a model's
// usage crosses it the model is treated as "exhausted" and the router falls
// back to another model automatically.

import type { ProviderName } from "@/types";

export interface ModelInfo {
  provider: ProviderName;
  /** API model id sent to the provider. */
  model: string;
  /** Human-facing label shown in the picker. */
  label: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  /** Per-workspace usage cap for this model (in tokens). */
  tokenLimit: number;
}

export const MODEL_CATALOG: ModelInfo[] = [
  // --- Anthropic (Claude) ---
  {
    provider: "anthropic",
    model: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    inputCostPer1k: 15,
    outputCostPer1k: 75,
    tokenLimit: 200000,
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    inputCostPer1k: 3,
    outputCostPer1k: 15,
    tokenLimit: 600000,
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    inputCostPer1k: 0.8,
    outputCostPer1k: 4,
    tokenLimit: 1000000,
  },
  // --- OpenAI (GPT) ---
  {
    provider: "openai",
    model: "gpt-4o",
    label: "GPT-4o",
    inputCostPer1k: 2.5,
    outputCostPer1k: 10,
    tokenLimit: 600000,
  },
  {
    provider: "openai",
    model: "gpt-4.1",
    label: "GPT-4.1",
    inputCostPer1k: 2,
    outputCostPer1k: 8,
    tokenLimit: 600000,
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    label: "GPT-4o mini",
    inputCostPer1k: 0.15,
    outputCostPer1k: 0.6,
    tokenLimit: 1000000,
  },
  {
    provider: "openai",
    model: "o3",
    label: "OpenAI o3",
    inputCostPer1k: 10,
    outputCostPer1k: 40,
    tokenLimit: 200000,
  },
  // --- Google (Gemini) ---
  {
    provider: "gemini",
    model: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    inputCostPer1k: 1.25,
    outputCostPer1k: 5,
    tokenLimit: 600000,
  },
  {
    provider: "gemini",
    model: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    inputCostPer1k: 0.1,
    outputCostPer1k: 0.4,
    tokenLimit: 1000000,
  },
];

const DEFAULT_INPUT_COST = 3;
const DEFAULT_OUTPUT_COST = 15;
const DEFAULT_MODEL_TOKEN_LIMIT = 500000;

export function getModelInfo(model: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.model === model);
}

/** Models available for a given provider. */
export function modelsForProvider(provider: ProviderName): ModelInfo[] {
  return MODEL_CATALOG.filter((m) => m.provider === provider);
}

/** Per-model token cap, with a safe default for unknown models. */
export function modelTokenLimit(model: string): number {
  return getModelInfo(model)?.tokenLimit ?? DEFAULT_MODEL_TOKEN_LIMIT;
}

/**
 * A single "cost weight" for a model, used only to rank models from cheapest to
 * most expensive (input + output combined). Lower = cheaper.
 */
export function modelCostWeight(model: string): number {
  const info = getModelInfo(model);
  if (!info) return DEFAULT_INPUT_COST + DEFAULT_OUTPUT_COST;
  return info.inputCostPer1k + info.outputCostPer1k;
}

/** Estimated credit cost of a call given token counts. */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const info = getModelInfo(model);
  const inCost = info?.inputCostPer1k ?? DEFAULT_INPUT_COST;
  const outCost = info?.outputCostPer1k ?? DEFAULT_OUTPUT_COST;
  return (inputTokens / 1000) * inCost + (outputTokens / 1000) * outCost;
}
