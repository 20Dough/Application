// Mention parser — pure detection and resolution of @mentions in message text.
//
// This module has NO database imports so it can be shared by client components
// (e.g. highlighting mentions in the composer) and server code (the AI Router).
//
// In this phase mentions resolve to AI agents, but the parser is deliberately
// future-ready for human user mentions: extraction is identity-agnostic (it just
// finds @handle tokens), and resolution returns a structure with a place for
// mentionedUserIds so the message-metadata contract is stable across phases.

// A mention handle uses the same character set as an agent's name (see
// lib/agents/profile.ts NAME_RE): letters, numbers, underscore and hyphen. The
// leading @ is required; matching is case-insensitive at resolution time.
const MENTION_RE = /@([A-Za-z0-9_-]+)/g;

/** The minimal agent shape the parser needs to resolve mentions. */
export type MentionableAgent = {
  id: string;
  name: string;
  displayName: string;
};

/** Structured result of resolving a message's mentions against known agents. */
export type ResolvedMentions = {
  /** Agent ids named by the message, in first-seen order, de-duplicated. */
  mentionedAgentIds: string[];
  /** Reserved for human mentions (always empty in this phase). */
  mentionedUserIds: string[];
  /** Every distinct handle typed (lower-cased, de-duplicated), in order. */
  rawMentions: string[];
  /** Handles that did not match any provided agent (lower-cased). */
  unmatched: string[];
};

/**
 * Extracts distinct @mention handles from text. Returns them lower-cased and
 * de-duplicated, preserving first-seen order. The leading @ is stripped.
 */
export function extractMentionHandles(content: string): string[] {
  if (!content) return [];
  const seen = new Set<string>();
  const handles: string[] = [];
  for (const match of content.matchAll(MENTION_RE)) {
    const handle = match[1].toLowerCase();
    if (!seen.has(handle)) {
      seen.add(handle);
      handles.push(handle);
    }
  }
  return handles;
}

/**
 * Resolves the mentions in `content` against a set of agents. Matching is
 * case-insensitive and tests both the agent handle (name) and its displayName,
 * so "@ari" and "@ARi" both resolve to the ARi agent. Each agent is selected at
 * most once even if mentioned by several aliases. Handles that match no agent
 * are returned in `unmatched` for callers that want to surface a notice.
 */
export function resolveMentions(
  content: string,
  agents: MentionableAgent[]
): ResolvedMentions {
  const rawMentions = extractMentionHandles(content);

  // Map every alias (handle + displayName, lower-cased) to its agent id.
  const aliasToId = new Map<string, string>();
  for (const agent of agents) {
    aliasToId.set(agent.name.toLowerCase(), agent.id);
    aliasToId.set(agent.displayName.toLowerCase(), agent.id);
  }

  const mentionedAgentIds: string[] = [];
  const seenIds = new Set<string>();
  const unmatched: string[] = [];

  for (const handle of rawMentions) {
    const agentId = aliasToId.get(handle);
    if (agentId) {
      if (!seenIds.has(agentId)) {
        seenIds.add(agentId);
        mentionedAgentIds.push(agentId);
      }
    } else {
      unmatched.push(handle);
    }
  }

  return { mentionedAgentIds, mentionedUserIds: [], rawMentions, unmatched };
}
