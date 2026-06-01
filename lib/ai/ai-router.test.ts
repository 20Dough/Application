import { describe, it, expect } from "vitest";
import { selectAgents, type SelectableAgent } from "@/lib/ai/ai-router";

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
