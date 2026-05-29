"use client";

import { use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { MembersPanel } from "@/components/workspace/MembersPanel";

// Workspace members page — manage the human team: view the roster, change
// roles, remove members, invite by email, and manage pending invitations.
// All access and mutation rules are enforced by the API; this page renders
// controls based on the current user's role.

export default function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  return (
    <AppShell subtitle="Members">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Human team</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage who can access this workspace and what they can do.
          </p>
        </div>
        <Link
          href={`/workspace/${workspaceId}`}
          className="shrink-0 text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Back to workspace
        </Link>
      </div>

      <MembersPanel workspaceId={workspaceId} />
    </AppShell>
  );
}
