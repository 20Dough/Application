"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  WorkspaceCard,
  type WorkspaceCardData,
} from "@/components/workspace/WorkspaceCard";
import { CreateWorkspaceForm } from "@/components/workspace/CreateWorkspaceForm";
import { PendingInvitations } from "@/components/workspace/PendingInvitations";

// Dashboard — lists the current user's workspaces and lets them create one.

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to load workspaces");
      const data = await res.json();
      setWorkspaces(data.workspaces ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return (
    <AppShell subtitle="Dashboard">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <section>
          <h1 className="text-2xl font-bold tracking-tight">Your workspaces</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Shared spaces where your human and AI team work together.
          </p>

          <div className="mt-6">
            <PendingInvitations onAccepted={loadWorkspaces} />
          </div>

          <div className="mt-6">
            {loading ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : workspaces.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
                You don&apos;t have any workspaces yet. Create one to get
                started.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {workspaces.map((ws) => (
                  <WorkspaceCard key={ws.id} workspace={ws} />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside>
          <CreateWorkspaceForm onCreated={loadWorkspaces} />
        </aside>
      </div>
    </AppShell>
  );
}
