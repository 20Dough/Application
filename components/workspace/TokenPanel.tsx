"use client";

import type { TokenInfo } from "@/types";

interface TokenPanelProps {
  tokens: TokenInfo | null;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function Bar({ used, limit }: { used: number; limit: number }) {
  const p = pct(used, limit);
  const danger = p >= 100;
  const warn = p >= 80;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-hive-panel">
      <div
        className={
          danger
            ? "h-full bg-red-500"
            : warn
              ? "h-full bg-amber-500"
              : "h-full bg-hive-accent"
        }
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export function TokenPanel({ tokens }: TokenPanelProps) {
  if (!tokens) {
    return <p className="text-xs text-hive-muted">Loading token usage…</p>;
  }

  const { workspace, app } = tokens;

  return (
    <div className="space-y-4">
      {/* Workspace pool */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hive-muted">
          Workspace Token Pool
        </h3>
        <div className="rounded-md border border-hive-border bg-hive-surface p-2.5">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-hive-text">
              {fmt(workspace.remaining)} left
            </span>
            <span className="text-[11px] text-hive-muted">
              {fmt(workspace.used)} / {fmt(workspace.limit)}
            </span>
          </div>
          <Bar used={workspace.used} limit={workspace.limit} />
          {workspace.remaining <= 0 && (
            <p className="mt-1.5 text-[11px] text-red-400">
              Pool exhausted — an admin can raise the limit.
            </p>
          )}
        </div>
      </div>

      {/* Per-model breakdown */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hive-muted">
          By Model
        </h3>
        {workspace.perModel.length === 0 ? (
          <p className="rounded-md border border-dashed border-hive-border px-2.5 py-3 text-center text-xs text-hive-muted">
            No AI usage yet.
          </p>
        ) : (
          <div className="space-y-2">
            {workspace.perModel.map((m) => (
              <div
                key={m.model}
                className="rounded-md border border-hive-border bg-hive-surface p-2.5"
              >
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-hive-text">
                    {m.label}
                  </span>
                  {m.exhausted ? (
                    <span className="text-[10px] font-medium text-red-400">
                      exhausted
                    </span>
                  ) : (
                    <span className="text-[10px] text-hive-muted">
                      {fmt(m.used)} / {fmt(m.limit)}
                    </span>
                  )}
                </div>
                <Bar used={m.used} limit={m.limit} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* App-wide aggregate */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hive-muted">
          Across the App
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-hive-border bg-hive-surface p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-hive-muted">
              Total tokens
            </p>
            <p className="text-sm font-semibold text-hive-text">
              {fmt(app.totalUsed)}
            </p>
          </div>
          <div className="rounded-md border border-hive-border bg-hive-surface p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-hive-muted">
              Avg / workspace
            </p>
            <p className="text-sm font-semibold text-hive-text">
              {fmt(app.averagePerWorkspace)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
