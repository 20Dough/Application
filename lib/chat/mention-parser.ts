// Mention parser — detects @mentions in message content.
//
// MVP: matches AI agents by normalized name or displayName (case-insensitive).
// Designed to be future-ready for human user mentions.

/** Minimal agent shape needed to resolve mentions. */
export interface MentionableAgent {
  id: string;
  name: string;
  displayName: string;
}

// The leading (?<!\w) negative lookbehind requires the @ to NOT follow a word
// character, so emails like "user@example.com" are not treated as mentions while
// "@ARi", "hey @Cloudy", and "(@Researcher)" still match.
const MENTION_REGEX = /(?<!\w)@([a-zA-Z0-9_-]+)/g;

export interface ParsedMentions {
  /** Normalized, de-duplicated mention handles found in the text. */
  rawMentions: string[];
  /** Agent ids matched from the mentions. */
  mentionedAgentIds: string[];
}

/**
 * Extract raw @mention handles from text. Case-insensitive and de-duplicated.
 */
export function extractMentions(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(MENTION_REGEX)) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

/**
 * Parse mentions and resolve them against a list of agents (typically the
 * active agents in a room). Matching is by normalized `name` or `displayName`.
 */
export function parseMentions(
  content: string,
  agents: MentionableAgent[],
): ParsedMentions {
  const rawMentions = extractMentions(content);
  const mentionedAgentIds = agents
    .filter(
      (agent) =>
        rawMentions.includes(agent.name.toLowerCase()) ||
        rawMentions.includes(agent.displayName.toLowerCase()),
    )
    .map((agent) => agent.id);

  return { rawMentions, mentionedAgentIds };
}
