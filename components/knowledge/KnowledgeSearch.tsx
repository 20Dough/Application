"use client";

import { useState } from "react";

// KnowledgeSearch — a small retrieval-preview box. Runs the same retrieval the
// AI Router uses (GET /api/knowledge/search) so the team can see which passages a
// question would surface, and how strongly they match. Read-only; any member may
// use it.

type Result = {
  sourceId: string;
  sourceTitle: string;
  content: string;
  score: number;
};

export function KnowledgeSearch({ workspaceId }: { workspaceId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/knowledge/search?workspaceId=${workspaceId}&q=${encodeURIComponent(q)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Search failed");
      }
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Preview retrieval — ask what your AI teammates would find…"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {results && !error && (
        <div className="mt-3 space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No relevant passages found for that query.
            </p>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.sourceId}-${i}`}
                className="rounded-md border border-neutral-800 bg-neutral-950 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-300">
                    {r.sourceTitle}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                    {(r.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap text-xs text-neutral-400">
                  {r.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
