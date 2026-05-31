"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

// Workspace detail page.
//
// Shows name, description, and the current user's role, plus links into the
// workspace's features (members, agents, rooms, memory, decisions). Access is
// gated by the API (membership required); a 403/404 is surfaced as a friendly
// message.

type WorkspaceDetail = {
  id: string;
  name: string;
  description?: string | null;
  role: string;
};

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

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href={`/workspace/${workspaceId}/members`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 transition-colors hover:border-neutral-600"
            >
              <div>
                <span className="block font-semibold text-neutral-100">
                  Human Members
                </span>
                <span className="block text-xs text-neutral-500">
                  View the team, manage roles, and invite people
                </span>
              </div>
              <span className="ml-auto text-neutral-500">→</span>
            </Link>
            <Link
              href={`/workspace/${workspaceId}/agents`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 transition-colors hover:border-neutral-600"
            >
              <div>
                <span className="block font-semibold text-neutral-100">
                  AI Agents
                </span>
                <span className="block text-xs text-neutral-500">
                  Manage your AI teammates (ARi, Cloudy, and more)
                </span>
              </div>
              <span className="ml-auto text-neutral-500">→</span>
            </Link>
            <Link
              href={`/workspace/${workspaceId}/rooms`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 transition-colors hover:border-neutral-600"
            >
              <div>
                <span className="block font-semibold text-neutral-100">
                  Rooms
                </span>
                <span className="block text-xs text-neutral-500">
                  Focused spaces for humans and AI agents to work together
                </span>
              </div>
              <span className="ml-auto text-neutral-500">→</span>
            </Link>
            <Link
              href={`/workspace/${workspaceId}/memory`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 transition-colors hover:border-neutral-600"
            >
              <div>
                <span className="block font-semibold text-neutral-100">
                  Memory & Context
                </span>
                <span className="block text-xs text-neutral-500">
                  Project context and shared memory the AI team reasons over
                </span>
              </div>
              <span className="ml-auto text-neutral-500">→</span>
            </Link>
            <Link
              href={`/workspace/${workspaceId}/knowledge`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 transition-colors hover:border-neutral-600"
            >
              <div>
                <span className="block font-semibold text-neutral-100">
                  Knowledge
                </span>
                <span className="block text-xs text-neutral-500">
                  Documents and text your AI teammates retrieve from when
                  answering
                </span>
              </div>
              <span className="ml-auto text-neutral-500">→</span>
            </Link>
            <Link
              href={`/workspace/${workspaceId}/decisions`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 transition-colors hover:border-neutral-600"
            >
              <div>
                <span className="block font-semibold text-neutral-100">
                  Decisions
                </span>
                <span className="block text-xs text-neutral-500">
                  AI-generated summaries of what the team decided, with next
                  steps
                </span>
              </div>
              <span className="ml-auto text-neutral-500">→</span>
            </Link>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
