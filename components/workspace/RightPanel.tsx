"use client";

import { useState } from "react";
import type {
  Agent,
  Decision,
  MemoryItem,
  ProjectContext,
  TokenInfo,
} from "@/types";
import { cn } from "@/lib/utils";
import { AgentEditor } from "@/components/agents/AgentEditor";
import { InlineAddForm } from "@/components/workspace/InlineAddForm";
import { TokenPanel } from "@/components/workspace/TokenPanel";

interface RightPanelProps {
  agents: Agent[];
  projectContext: ProjectContext[];
  memory: MemoryItem[];
  decisions: Decision[];
  tokens: TokenInfo | null;
  canManage: boolean;
  onAddMemory: (title: string, content: string) => Promise<void>;
  onAddContext: (title: string, content: string) => Promise<void>;
  onUpdateAgent: (
    agentId: string,
    patch: Partial<
      Pick<Agent, "displayName" | "provider" | "model" | "role" | "isActive">
    >,
  ) => Promise<void>;
  /** Close the mobile/tablet drawer (only rendered on small screens). */
  onClose?: () => void;
}

type Tab = "agents" | "context" | "memory" | "decisions" | "tokens";

const tabs: { id: Tab; label: string }[] = [
  { id: "agents", label: "Agents" },
  { id: "context", label: "Context" },
  { id: "memory", label: "Memory" },
  { id: "decisions", label: "Decisions" },
  { id: "tokens", label: "Tokens" },
];

export function RightPanel({
  agents,
  projectContext,
  memory,
  decisions,
  tokens,
  canManage,
  onAddMemory,
  onAddContext,
  onUpdateAgent,
  onClose,
}: RightPanelProps) {
  const [tab, setTab] = useState<Tab>("agents");

  return (
    <aside className="flex h-full w-full flex-col border-l border-hive-border bg-hive-panel xl:w-80">
      {/* Mobile/tablet close bar */}
      {onClose && (
        <div className="flex items-center justify-between border-b border-hive-border px-3 py-2 xl:hidden">
          <span className="text-xs font-semibold uppercase tracking-wide text-hive-muted">
            Details
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex h-7 w-7 items-center justify-center rounded text-hive-muted transition hover:bg-hive-surface hover:text-hive-text"
          >
            ✕
          </button>
        </div>
      )}
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
            <AgentEditor
              agents={agents}
              canManage={canManage}
              onUpdate={onUpdateAgent}
            />
          </Section>
        )}

        {tab === "tokens" && (
          <Section title="Token Usage">
            <TokenPanel tokens={tokens} />
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
        {badge && <span className="text-[10px] text-hive-accent">{badge}</span>}
      </div>
      <div className="text-xs leading-relaxed text-hive-text/80">
        {children}
      </div>
    </div>
  );
}
