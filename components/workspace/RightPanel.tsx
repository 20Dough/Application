"use client";

import { useState } from "react";
import type { Agent, Decision, MemoryItem, ProjectContext } from "@/types";
import { cn } from "@/lib/utils";
import { AgentList } from "@/components/agents/AgentList";
import { InlineAddForm } from "@/components/workspace/InlineAddForm";

interface RightPanelProps {
  agents: Agent[];
  projectContext: ProjectContext[];
  memory: MemoryItem[];
  decisions: Decision[];
  canManage: boolean;
  onAddMemory: (title: string, content: string) => Promise<void>;
  onAddContext: (title: string, content: string) => Promise<void>;
  onManageAgents: () => void;
}

type Tab = "agents" | "context" | "memory" | "decisions";

const tabs: { id: Tab; label: string }[] = [
  { id: "agents", label: "Agents" },
  { id: "context", label: "Context" },
  { id: "memory", label: "Memory" },
  { id: "decisions", label: "Decisions" },
];

export function RightPanel({
  agents,
  projectContext,
  memory,
  decisions,
  canManage,
  onAddMemory,
  onAddContext,
  onManageAgents,
}: RightPanelProps) {
  const [tab, setTab] = useState<Tab>("agents");

  return (
    <aside className="flex h-full w-80 flex-col border-l border-hive-border bg-hive-panel">
      {/* Tabs */}
      <div className="flex border-b border-hive-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 px-2 py-2.5 text-xs font-medium transition",
              tab === t.id
                ? "border-b-2 border-hive-accent text-hive-text"
                : "text-hive-muted hover:text-hive-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "agents" && (
          <Section
            title="AI Agents"
            action={{ label: "Manage", onClick: onManageAgents }}
          >
            <AgentList agents={agents} />
          </Section>
        )}

        {tab === "context" && (
          <Section title="Project Context">
            {projectContext.length === 0 && (
              <Empty>No project context yet.</Empty>
            )}
            {projectContext.map((ctx) => (
              <Card key={ctx.id} title={ctx.title}>
                {ctx.content}
              </Card>
            ))}
            {canManage && (
              <InlineAddForm
                label="+ Add project context"
                onSubmit={onAddContext}
                titlePlaceholder="e.g. Mission"
                contentPlaceholder="The stable identity / direction of this workspace"
              />
            )}
          </Section>
        )}

        {tab === "memory" && (
          <Section title="Shared Memory">
            {memory.length === 0 && <Empty>No shared memory yet.</Empty>}
            {memory.map((item) => (
              <Card
                key={item.id}
                title={item.title}
                badge={`★ ${item.importance}`}
              >
                {item.content}
              </Card>
            ))}
            {canManage && (
              <InlineAddForm
                label="+ Add memory"
                onSubmit={onAddMemory}
                titlePlaceholder="e.g. Tech stack"
                contentPlaceholder="An important long-term fact for the team"
              />
            )}
          </Section>
        )}

        {tab === "decisions" && (
          <Section title="Decisions">
            {decisions.length === 0 && (
              <Empty>No decisions yet. Use ✦ Summarize in a room.</Empty>
            )}
            {decisions.map((d) => (
              <Card key={d.id} title={d.title}>
                <p className="mb-2">{d.summary}</p>
                {d.actionItems && d.actionItems.length > 0 && (
                  <ul className="space-y-1">
                    {d.actionItems.map((item, i) => (
                      <li key={i} className="flex gap-1.5 text-hive-muted">
                        <span className="text-hive-accent">▸</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-hive-border px-2.5 py-3 text-center text-xs text-hive-muted">
      {children}
    </p>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-hive-muted">
          {title}
        </h3>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-[11px] text-hive-muted transition hover:text-hive-accent"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-hive-border bg-hive-surface p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-hive-text">{title}</span>
        {badge && <span className="text-[10px] text-hive-accent">{badge}</span>}
      </div>
      <div className="text-xs leading-relaxed text-hive-text/80">
        {children}
      </div>
    </div>
  );
}
