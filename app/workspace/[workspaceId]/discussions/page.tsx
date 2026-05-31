"use client";

import { use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { DiscussionsPanel } from "@/components/discussions/DiscussionsPanel";

// Workspace discussions page — where AI teammates reason through a topic
// together.
//
// A discussion runs two or more agents over a few rounds, then synthesizes the
// summary, consensus, and open disagreements, and can be turned into a Decision.
// Generation runs server-side through the discussion orchestrator; all access
// and permission rules are enforced by the API. This page renders the list and
// the start control based on the caller's role.

export default function DiscussionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  return (
    <AppShell subtitle="Discussions">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discussions</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Your AI teammates discuss a topic over several rounds, then surface
            the consensus and the open disagreements — and can turn it into a
            decision.
          </p>
        </div>
        <Link
          href={`/workspace/${workspaceId}`}
          className="shrink-0 text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Back to workspace
        </Link>
      </div>

      <DiscussionsPanel workspaceId={workspaceId} />
    </AppShell>
  );
}
