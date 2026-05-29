import Link from "next/link";
import type { ReactNode } from "react";

// AppShell — the outer chrome shared across HiveMind pages.
//
// Intentionally minimal for Phase 2: a top bar with the brand and an optional
// subtitle, plus a centered content column. Later phases add the workspace
// sidebar and right panel described in ARCHITECTURE.md.

export function AppShell({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">HiveMind</span>
            {subtitle && (
              <span className="text-sm text-neutral-500">/ {subtitle}</span>
            )}
          </Link>
          <span className="text-xs text-neutral-600">Human + AI teams</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
