import { describe, it, expect } from "vitest";
import {
  shouldSearch,
  webSearch,
  formatSearchResults,
} from "@/lib/ai/tools/web-search";

describe("shouldSearch", () => {
  it("fires on fresh-info triggers (English, Thai, URLs, years)", () => {
    expect(shouldSearch("what is the latest news?")).toBe(true);
    expect(shouldSearch("ช่วยค้นหาราคาหน่อย")).toBe(true);
    expect(shouldSearch("see https://example.com")).toBe(true);
    expect(shouldSearch("what changed in 2025?")).toBe(true);
  });

  it("stays quiet for ordinary chat", () => {
    expect(shouldSearch("hello there, nice to meet you")).toBe(false);
    expect(shouldSearch("")).toBe(false);
  });
});

describe("webSearch (no API key → mock fallback)", () => {
  it("returns a labeled mock result without hitting the network", async () => {
    delete process.env.SEARCH_API_KEY;
    const out = await webSearch("anything");
    expect(out.live).toBe(false);
    expect(out.results).toHaveLength(1);

    const block = formatSearchResults(out);
    expect(block).toContain("anything");
    expect(block).toContain("mock");
  });
});
