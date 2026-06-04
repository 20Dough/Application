import { describe, it, expect } from "vitest";
import { estimateTokens, estimateTokensFor } from "@/lib/tokens/tokenizer";

describe("estimateTokens", () => {
  it("treats empty / nullish input as zero", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });

  it("counts real tokens (not chars/4)", () => {
    // "hello world" is 2 tokens under o200k_base — far from 11/4.
    expect(estimateTokens("hello world")).toBe(2);
  });

  it("grows with longer text", () => {
    const short = estimateTokens("one two three");
    const long = estimateTokens("one two three ".repeat(20));
    expect(long).toBeGreaterThan(short);
  });

  it("uses the older encoding for legacy OpenAI models without crashing", () => {
    expect(estimateTokens("hello world", "gpt-4-turbo")).toBeGreaterThan(0);
    expect(estimateTokens("hello world", "claude-opus-4-8")).toBeGreaterThan(0);
  });
});

describe("estimateTokensFor", () => {
  it("sums across parts and ignores nullish", () => {
    const parts = ["hello world", null, "hello world", undefined];
    expect(estimateTokensFor(parts)).toBe(4); // 2 + 2
  });
});
