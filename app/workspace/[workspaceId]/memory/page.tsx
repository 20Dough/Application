"use client";

import { use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectContextPanel } from "@/components/memory/ProjectContextPanel";
import { MemoryPanel } from "@/components/memory/MemoryPanel";

// Workspace memory & context page — curate the shared knowledge the AI team
// reasons over: high-priority Project Context (identity and mission) and
// long-term Shared Memory (curated facts). Both feed the AI Router's context
// builder. All access and mutation rules are enforced by the API; this page
// renders controls based on the caller's role.

export default function MemoryPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  return (
    <AppShell subtitle="Memory & context">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memory & context</h1>
          <p className="mt-1 text-sm text-neutral-500">
            The shared knowledge your AI teammates reason over. Project context
            leads every prompt; memory keeps the important details in view.
          </p>
        </div>
        <Link
          href={`/workspace/${workspaceId}`}
          className="shrink-0 text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Back to workspace
        </Link>
      </div>

      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-neutral-100">
            Project context
          </h2>
          <p className="text-sm text-neutral-500">
            Highest-priority identity and mission. Comes before memory in every
            agent&apos;s context.
          </p>
        </div>
        <ProjectContextPanel workspaceId={workspaceId} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-neutral-100">
            Shared memory
          </h2>
          <p className="text-sm text-neutral-500">
            Curated long-term facts, ranked by importance and optionally scoped
            to a single room.
          </p>
        </div>
        <MemoryPanel workspaceId={workspaceId} />
      </section>
    </AppShell>
  );
}
