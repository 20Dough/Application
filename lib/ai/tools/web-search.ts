// Web search tool — gives every AI agent access to fresh information from the
// internet, independent of which provider it runs on.
//
// Real search runs through the Tavily API when SEARCH_API_KEY is set; otherwise
// it returns a clearly-labeled mock result so the feature is fully wired and the
// app keeps working locally with no key or network (per the dev-mode rules).

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOutput {
  query: string;
  results: SearchResult[];
  /** True when results came from the real API; false for the mock fallback. */
  live: boolean;
}

// Heuristic: only search when the message plausibly needs fresh/external facts,
// so we don't waste tokens or latency on every message. Matches English + Thai
// trigger words, explicit URLs, and 4-digit years.
const SEARCH_TRIGGERS =
  /\b(search|google|look up|latest|news|today|current|recent|price|weather|who is|what is|when did|release|version|stock|score|2023|2024|2025|2026)\b|https?:\/\/|ค้นหา|ล่าสุด|ข่าว|ราคา|วันนี้|ปัจจุบัน|เมื่อไหร่|อัปเดต/i;

export function shouldSearch(content: string): boolean {
  if (!content) return false;
  return SEARCH_TRIGGERS.test(content);
}

const MAX_RESULTS = 5;

export async function webSearch(query: string): Promise<WebSearchOutput> {
  const apiKey = process.env.SEARCH_API_KEY;
  if (!apiKey) return mockSearch(query);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: MAX_RESULTS,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      console.error(`[web-search] ${res.status}: ${await res.text()}`);
      return mockSearch(query);
    }

    const data = await res.json();
    const results: SearchResult[] = (data.results ?? [])
      .slice(0, MAX_RESULTS)
      .map((r: { title?: string; url?: string; content?: string }) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: (r.content ?? "").slice(0, 300),
      }));
    return { query, results, live: true };
  } catch (err) {
    console.error("[web-search] request failed:", err);
    return mockSearch(query);
  }
}

function mockSearch(query: string): WebSearchOutput {
  return {
    query,
    live: false,
    results: [
      {
        title: `(mock) Search results for "${query}"`,
        url: "https://example.com/search",
        snippet:
          "No SEARCH_API_KEY is configured, so this is a placeholder result. Set SEARCH_API_KEY to enable live web search for all agents.",
      },
    ],
  };
}

/** Render results as a context block to inject into an agent's system prompt. */
export function formatSearchResults(output: WebSearchOutput): string {
  const lines = [
    `Web Search Results${output.live ? "" : " (mock — no SEARCH_API_KEY)"} for "${output.query}":`,
  ];
  output.results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`);
  });
  return lines.join("\n");
}
