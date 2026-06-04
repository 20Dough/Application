import { describe, it, expect } from "vitest";
import { estimateTokens, estimateTokensFor } from "@/lib/tokens/tokenizer";

describe("estimateTokens", () => {
  it("treats empty / nullish input as zero", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });

  it("uses ~4 chars per token, rounding up", () => {
    expect(estimateTokens("abcd")).toBe(1); // 4/4
    expect(estimateTokens("abcde")).toBe(2); // ceil(5/4)
  });
});

describe("estimateTokensFor", () => {
  it("sums across parts and ignores nullish", () => {
    expect(estimateTokensFor("abcd", "abcd", null, undefined)).toBe(2);
  });
});
