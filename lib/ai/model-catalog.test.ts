import { describe, it, expect } from "vitest";
import {
  getModelInfo,
  modelsForProvider,
  modelTokenLimit,
  modelCostWeight,
  estimateCost,
} from "@/lib/ai/model-catalog";

describe("model catalog", () => {
  it("looks up a known model and returns undefined for unknown", () => {
    expect(getModelInfo("gpt-4o")?.provider).toBe("openai");
    expect(getModelInfo("not-a-model")).toBeUndefined();
  });

  it("lists only the requested provider's models", () => {
    const anthropic = modelsForProvider("anthropic");
    expect(anthropic.length).toBeGreaterThan(0);
    expect(anthropic.every((m) => m.provider === "anthropic")).toBe(true);
    expect(anthropic.map((m) => m.model)).toContain("claude-opus-4-8");
  });

  it("ranks cheaper models below expensive ones", () => {
    expect(modelCostWeight("claude-haiku-4-5-20251001")).toBeLessThan(
      modelCostWeight("claude-sonnet-4-6"),
    );
    expect(modelCostWeight("claude-sonnet-4-6")).toBeLessThan(
      modelCostWeight("claude-opus-4-8"),
    );
  });

  it("falls back to a default cost/limit for unknown models", () => {
    expect(modelCostWeight("mystery")).toBe(18); // 3 + 15 default
    expect(modelTokenLimit("mystery")).toBe(500000);
  });

  it("estimates cost from token counts and per-1k pricing", () => {
    // gpt-4o = 2.5 in / 10 out per 1k → 1k in + 1k out = 12.5
    expect(estimateCost("gpt-4o", 1000, 1000)).toBeCloseTo(12.5);
  });
});
