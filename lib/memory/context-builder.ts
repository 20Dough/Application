import type { ProviderInput, ProviderMessage } from "@/lib/ai/types";

// Context builder — assembles the system prompt and conversation transcript a
// provider receives for one agent. Follows the priority order from ARCHITECTURE:
//
//   1. Agent system prompt
//   2. ProjectContext        (higher priority than memory — stable identity)
//   3. Workspace info
//   4. Room info
//   5. Important MemoryItems
//   6. Recent Decisions
//   7. Recent messages       (bounded — never the full history)
//   8. Current message       (the latest entry in the recent messages)
//
// Static, curated context (1–6) goes into the system prompt; the recent
// conversation (7–8) is passed as the chat transcript so providers see who said
// what. The current human message is simply the last recent message.

// Never send unlimited history; the MVP uses the latest N messages.
const RECENT_MESSAGE_LIMIT = 30;
// Bound the curated context so prompts stay focused and costs predictable.
const MEMORY_LIMIT = 10;
const DECISION_LIMIT = 5;

type NamedContent = { title: string; content: string };

/** Minimal agent identity the builder needs. */
export type ContextAgent = {
  id: string;
  systemPrompt: string;
};

/** A room message as needed for the transcript. */
export type ContextMessage = {
  senderType: string;
  content: string;
  agentId: string | null;
  user: { name: string | null; email: string } | null;
  agent: { displayName: string } | null;
};

export type ContextSources = {
  agent: ContextAgent;
  workspace: { name: string; description: string | null };
  room: { name: string; description: string | null };
  projectContexts: NamedContent[];
  memoryItems: Array<NamedContent & { importance: number }>;
  decisions: Array<{ title: string; summary: string }>;
  /** Recent room messages, oldest → newest (the current message is last). */
  messages: ContextMessage[];
};

/**
 * Builds the provider input (system prompt + transcript) for an agent. The
 * model id is filled in by the caller from the agent record.
 */
export function buildAgentContext(
  sources: ContextSources
): Omit<ProviderInput, "model"> {
  return {
    systemPrompt: buildSystemPrompt(sources),
    messages: buildTranscript(sources.messages, sources.agent.id),
  };
}

function buildSystemPrompt(sources: ContextSources): string {
  const sections: string[] = [sources.agent.systemPrompt.trim()];

  if (sources.projectContexts.length > 0) {
    sections.push(
      heading("Project Context", namedList(sources.projectContexts))
    );
  }

  sections.push(
    heading(
      "Workspace",
      `Name: ${sources.workspace.name}` +
        (sources.workspace.description
          ? `\nDescription: ${sources.workspace.description}`
          : "")
    )
  );

  sections.push(
    heading(
      "Room",
      `Name: ${sources.room.name}` +
        (sources.room.description
          ? `\nDescription: ${sources.room.description}`
          : "")
    )
  );

  // Important memory first (highest importance), bounded.
  const memory = [...sources.memoryItems]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, MEMORY_LIMIT);
  if (memory.length > 0) {
    sections.push(heading("Important Memory", namedList(memory)));
  }

  const decisions = sources.decisions.slice(0, DECISION_LIMIT);
  if (decisions.length > 0) {
    sections.push(
      heading(
        "Recent Decisions",
        decisions.map((d) => `- ${d.title}: ${d.summary}`).join("\n")
      )
    );
  }

  return sections.join("\n\n");
}

// Maps recent messages to a provider transcript. The agent's own past messages
// become "assistant" turns; everyone else (humans and other agents) become
// "user" turns prefixed with the speaker's name so the model can follow the
// multi-party conversation. System messages are omitted from the transcript.
function buildTranscript(
  messages: ContextMessage[],
  agentId: string
): ProviderMessage[] {
  const recent = messages.slice(-RECENT_MESSAGE_LIMIT);
  const transcript: ProviderMessage[] = [];

  for (const message of recent) {
    if (message.senderType === "system") continue;

    if (message.senderType === "agent" && message.agentId === agentId) {
      transcript.push({ role: "assistant", content: message.content });
      continue;
    }

    transcript.push({
      role: "user",
      content: `${speakerName(message)}: ${message.content}`,
    });
  }

  return transcript;
}

function speakerName(message: ContextMessage): string {
  if (message.senderType === "agent") {
    return message.agent?.displayName ?? "Agent";
  }
  return message.user?.name || message.user?.email || "Someone";
}

function namedList(items: NamedContent[]): string {
  return items.map((i) => `- ${i.title}: ${i.content}`).join("\n");
}

function heading(title: string, body: string): string {
  return `${title}:\n${body}`;
}
