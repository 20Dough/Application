"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

// Workspace detail page.
//
// Shows name, description, and the current user's role, plus placeholder
// sections for features arriving in later phases. Access is gated by the API
// (membership required); a 403/404 is surfaced as a friendly message.

type WorkspaceDetail = {
  id: string;
  name: string;
  description?: string | null;
  role: string;
};

const COMING_SOON: { title: string; note: string }[] = [
  { title: "Rooms", note: "Coming in Phase 3" },
  { title: "Human Members", note: "Coming later" },
  { title: "AI Agents", note: "Coming later" },
  { title: "Memory", note: "Coming later" },
  { title: "Decisions", note: "Coming later" },
];

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            data?.error ||
              (res.status === 403
                ? "You do not have access to this workspace"
                : "Workspace not found")
          );
        }
        const data = await res.json();
        if (!cancelled) setWorkspace(data.workspace);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <AppShell subtitle="Workspace">
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : error ? (
        <div className="rounded-lg border border-neutral-800 p-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-neutral-400 underline hover:text-neutral-200"
          >
            Back to dashboard
          </Link>
        </div>
      ) : workspace ? (
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {workspace.name}
              </h1>
              <p className="mt-1 text-sm text-neutral-400">
                {workspace.description || "No description"}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-neutral-700 px-3 py-1 text-xs capitalize text-neutral-300">
              Your role: {workspace.role}
            </span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON.map((section) => (
              <div
                key={section.title}
                className="rounded-lg border border-dashed border-neutral-800 p-5"
              >
                <h2 className="font-semibold text-neutral-300">
                  {section.title}
                </h2>
                <p className="mt-1 text-xs text-neutral-600">{section.note}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
