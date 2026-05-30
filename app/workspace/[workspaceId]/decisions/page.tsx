"use client";

import { use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { DecisionsPanel } from "@/components/decisions/DecisionsPanel";

// Workspace decisions page — the shared record of what the team decided.
//
// Decisions are AI-generated summaries of a room's recent messages: a title, a
// short summary, and action items. Generation runs through the AI Router; all
// access and permission rules are enforced by the API. This page renders the
// list and the generate control based on the caller's role.

export default function DecisionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  return (
    <AppShell subtitle="Decisions">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decisions</h1>
          <p className="mt-1 text-sm text-neutral-500">
            AI-generated summaries of what your team decided in a room, with the
            next steps to act on.
          </p>
        </div>
        <Link
          href={`/workspace/${workspaceId}`}
          className="shrink-0 text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Back to workspace
        </Link>
      </div>

      <DecisionsPanel workspaceId={workspaceId} />
    </AppShell>
  );
}
