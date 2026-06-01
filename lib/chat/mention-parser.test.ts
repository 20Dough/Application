import { describe, it, expect } from "vitest";
import {
  extractMentions,
  parseMentions,
  type MentionableAgent,
} from "@/lib/chat/mention-parser";

const agents: MentionableAgent[] = [
  { id: "a_ari", name: "ari", displayName: "ARi" },
  { id: "a_cloudy", name: "cloudy", displayName: "Cloudy" },
  { id: "a_researcher", name: "researcher", displayName: "Researcher" },
];

describe("extractMentions", () => {
  it("extracts a single mention", () => {
    expect(extractMentions("@ARi help me")).toEqual(["ari"]);
  });

  it("is case-insensitive and normalizes to lowercase", () => {
    expect(extractMentions("@ARi @cloudy")).toEqual(["ari", "cloudy"]);
  });

  it("de-duplicates repeated mentions", () => {
    expect(extractMentions("@ARi @ari @ARI")).toEqual(["ari"]);
  });

  it("returns nothing when there are no mentions", () => {
    expect(extractMentions("just a normal message")).toEqual([]);
  });

  it("does NOT treat an email address as a mention", () => {
    expect(extractMentions("contact van@example.com please")).toEqual([]);
  });

  it("matches a mention after punctuation or whitespace", () => {
    expect(extractMentions("hey (@Cloudy) and @ARi!")).toEqual([
      "cloudy",
      "ari",
    ]);
  });
});

describe("parseMentions", () => {
  it("resolves mentions to agent ids by name", () => {
    const { mentionedAgentIds } = parseMentions("@ari design the db", agents);
    expect(mentionedAgentIds).toEqual(["a_ari"]);
  });

  it("resolves by displayName too", () => {
    const { mentionedAgentIds } = parseMentions("@Cloudy review this", agents);
    expect(mentionedAgentIds).toEqual(["a_cloudy"]);
  });

  it("resolves multiple mentioned agents", () => {
    const { mentionedAgentIds } = parseMentions(
      "@ARi @Cloudy compare options",
      agents,
    );
    expect(mentionedAgentIds).toEqual(["a_ari", "a_cloudy"]);
  });

  it("ignores mentions that match no agent", () => {
    const { mentionedAgentIds, rawMentions } = parseMentions(
      "@nobody hello",
      agents,
    );
    expect(rawMentions).toEqual(["nobody"]);
    expect(mentionedAgentIds).toEqual([]);
  });

  it("does not match an email-embedded handle", () => {
    const { mentionedAgentIds } = parseMentions(
      "ping ari@cloudy.com",
      agents,
    );
    expect(mentionedAgentIds).toEqual([]);
  });
});
