"use client";

import { use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { KnowledgePanel } from "@/components/knowledge/KnowledgePanel";

// Workspace knowledge page (Phase 11 — Knowledge & RAG).
//
// Curate the documents and text your AI teammates can draw on. Each source is
// chunked and embedded on ingestion; the AI Router retrieves the most relevant
// passages and injects them into an agent's context when answering. Knowledge
// may be workspace-wide or scoped to a single room. All access and mutation
// rules are enforced by the API; this page renders controls based on the
// caller's role.

export default function KnowledgePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  return (
    <AppShell subtitle="Knowledge">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Documents and text your AI teammates can retrieve from when they
            answer. Sources are chunked and embedded so only the relevant parts
            reach the model.
          </p>
        </div>
        <Link
          href={`/workspace/${workspaceId}`}
          className="shrink-0 text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Back to workspace
        </Link>
      </div>

      <KnowledgePanel workspaceId={workspaceId} />
    </AppShell>
  );
}
