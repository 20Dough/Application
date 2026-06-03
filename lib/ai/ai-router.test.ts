import { describe, it, expect } from "vitest";
import {
  selectAgents,
  cheapestAgent,
  applyExhaustionFallback,
  type SelectableAgent,
} from "@/lib/ai/ai-router";

function agent(
  id: string,
  name: string,
  overrides: Partial<SelectableAgent> = {},
): SelectableAgent {
  return {
    id,
    name,
    displayName: name,
    provider: "openai",
    model: "gpt-4o",
    role: "Teammate",
    systemPrompt: "",
    isActive: true,
    ...overrides,
  };
}

const ari = agent("a_ari", "ari");
const cloudy = agent("a_cloudy", "cloudy", { provider: "anthropic" });
const active = [ari, cloudy];

describe("selectAgents", () => {
  it("selects the single mentioned agent", () => {
    const result = selectAgents({
      mentionedAgentIds: ["a_cloudy"],
      activeAgents: active,
      defaultAgentId: "a_ari",
    });
    expect(result.map((a) => a.id)).toEqual(["a_cloudy"]);
  });

  it("selects all mentioned agents", () => {
    const result = selectAgents({
      mentionedAgentIds: ["a_ari", "a_cloudy"],
      activeAgents: active,
      defaultAgentId: null,
    });
    expect(result.map((a) => a.id)).toEqual(["a_ari", "a_cloudy"]);
  });

  it("falls back to the room default agent when nothing is mentioned", () => {
    const result = selectAgents({
      mentionedAgentIds: [],
      activeAgents: active,
      defaultAgentId: "a_cloudy",
    });
    expect(result.map((a) => a.id)).toEqual(["a_cloudy"]);
  });

  it("falls back to ARi when there is no default agent", () => {
    const result = selectAgents({
      mentionedAgentIds: [],
      activeAgents: active,
      defaultAgentId: null,
    });
    expect(result.map((a) => a.id)).toEqual(["a_ari"]);
  });

  it("ignores a default agent id that is not active/in the room", () => {
    const result = selectAgents({
      mentionedAgentIds: [],
      activeAgents: [cloudy], // ari not active
      defaultAgentId: "a_ari",
    });
    // No active default, no ARi → empty
    expect(result).toEqual([]);
  });

  it("returns empty when no agents are active and nothing matches", () => {
    const result = selectAgents({
      mentionedAgentIds: [],
      activeAgents: [],
      defaultAgentId: null,
    });
    expect(result).toEqual([]);
  });

  it("only returns mentioned agents that are in the active list", () => {
    const result = selectAgents({
      mentionedAgentIds: ["a_ari", "a_ghost"],
      activeAgents: active,
      defaultAgentId: null,
    });
    expect(result.map((a) => a.id)).toEqual(["a_ari"]);
  });
});

describe("cheapestAgent", () => {
  it("picks the agent running the cheapest model", () => {
    const opus = agent("a_opus", "opus", { model: "claude-opus-4-8" });
    const haiku = agent("a_haiku", "haiku", {
      model: "claude-haiku-4-5-20251001",
    });
    expect(cheapestAgent([opus, haiku]).id).toBe("a_haiku");
  });
});

describe("applyExhaustionFallback", () => {
  const opus = agent("a_opus", "opus", { model: "claude-opus-4-8" });
  const mini = agent("a_mini", "mini", { model: "gpt-4o-mini" });

  it("keeps the agent when its model is not exhausted", () => {
    const plan = applyExhaustionFallback([opus], [opus, mini], new Set());
    expect(plan).toEqual([{ agent: opus }]);
  });

  it("swaps to the cheapest open model when the target is exhausted", () => {
    const plan = applyExhaustionFallback(
      [opus],
      [opus, mini],
      new Set(["claude-opus-4-8"]),
    );
    expect(plan[0].agent.id).toBe("a_mini");
    expect(plan[0].replacedFrom?.id).toBe("a_opus");
  });

  it("flags exhaustion when no replacement model is available", () => {
    const plan = applyExhaustionFallback(
      [opus],
      [opus],
      new Set(["claude-opus-4-8"]),
    );
    expect(plan[0].exhaustedNoRepl).toBe(true);
  });
});
