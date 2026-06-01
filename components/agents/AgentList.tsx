"use client";

import type { Agent } from "@/types";
import { cn, initials, providerColor } from "@/lib/utils";

interface AgentListProps {
  agents: Agent[];
}

export function AgentList({ agents }: AgentListProps) {
  return (
    <ul className="space-y-1.5">
      {agents.map((agent) => {
        const color = providerColor(agent.provider);
        return (
          <li
            key={agent.id}
            className="flex items-start gap-2.5 rounded-md border border-hive-border bg-hive-surface px-2.5 py-2"
          >
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {initials(agent.displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-hive-text">
                  {agent.displayName}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    agent.isActive ? "bg-green-500" : "bg-hive-muted",
                  )}
                  title={agent.isActive ? "Active" : "Inactive"}
                />
              </div>
              <p className="truncate text-xs text-hive-muted">{agent.role}</p>
              <span
                className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize"
                style={{ backgroundColor: `${color}22`, color }}
              >
                {agent.provider}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
