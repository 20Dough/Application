import { db } from "@/lib/db";
import type { Agent } from "@prisma/client";
import { DEFAULT_AGENTS } from "@/lib/agents/registry";

// Default-agent seeding.
//
// Every workspace starts with an AI team. This module creates the default
// agents (ARi, Cloudy) for a workspace. It is the only place that writes the
// default blueprints to the database, and it is idempotent: agents that already
// exist (matched on the unique workspaceId + name constraint) are left
// untouched, so it is safe to call on workspace creation and to re-run later to
// restore missing defaults.

/**
 * Ensures the default agents exist for a workspace. Returns the agents that
 * were newly created (existing ones are skipped).
 */
export async function seedDefaultAgents(
  workspaceId: string
): Promise<Agent[]> {
  const existing = await db.agent.findMany({
    where: { workspaceId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((a) => a.name));

  const missing = DEFAULT_AGENTS.filter((a) => !existingNames.has(a.name));
  if (missing.length === 0) return [];

  // Create sequentially so the return value (full records) is available; the
  // default set is tiny, so this is fine.
  const created: Agent[] = [];
  for (const blueprint of missing) {
    created.push(
      await db.agent.create({
        data: { ...blueprint, workspaceId },
      })
    );
  }
  return created;
}
