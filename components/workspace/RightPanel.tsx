"use client";

import { useState } from "react";
import type { Agent, Decision, MemoryItem, ProjectContext } from "@/types";
import { cn } from "@/lib/utils";
import { AgentList } from "@/components/agents/AgentList";

interface RightPanelProps {
  agents: Agent[];
  projectContext: ProjectContext[];
  memory: MemoryItem[];
  decisions: Decision[];
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
          <Section title="AI Agents">
            <AgentList agents={agents} />
          </Section>
        )}

        {tab === "context" && (
          <Section title="Project Context">
            {projectContext.map((ctx) => (
              <Card key={ctx.id} title={ctx.title}>
                {ctx.content}
              </Card>
            ))}
          </Section>
        )}

        {tab === "memory" && (
          <Section title="Shared Memory">
            {memory.map((item) => (
              <Card
                key={item.id}
                title={item.title}
                badge={`★ ${item.importance}`}
              >
                {item.content}
              </Card>
            ))}
          </Section>
        )}

        {tab === "decisions" && (
          <Section title="Decisions">
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hive-muted">
        {title}
      </h3>
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
        {badge && (
          <span className="text-[10px] text-hive-accent">{badge}</span>
        )}
      </div>
      <div className="text-xs leading-relaxed text-hive-text/80">{children}</div>
    </div>
  );
}
