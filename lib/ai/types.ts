// Provider abstraction — the common interface every AI provider implements.
//
// HiveMind separates AI *identity* (the agent the user talks to) from the
// *provider/model* that powers it. The AI Router selects an agent, builds
// context, then calls the agent's provider through this single interface. Adding
// a new provider (Gemini, Perplexity, a local model, …) means implementing
// AIProvider and registering it in the factory — nothing else changes.

/** A single turn of conversation handed to a provider. */
export type ProviderMessage = {
  /** "user" = a human or another agent; "assistant" = this agent's own past turn. */
  role: "user" | "assistant";
  content: string;
};

/** Everything a provider needs to generate one response. */
export type ProviderInput = {
  /** The provider-specific model id (e.g. "gpt-4o", "claude-3-5-sonnet-…"). */
  model: string;
  /** The fully-built system prompt (agent persona + curated context). */
  systemPrompt: string;
  /** Recent conversation, oldest → newest; the latest user turn is last. */
  messages: ProviderMessage[];
};

/** A provider's response plus optional usage for cost/auditing. */
export type ProviderResult = {
  /** The generated assistant text. */
  content: string;
  inputTokens?: number;
  outputTokens?: number;
};

/** The common interface all providers implement. */
export interface AIProvider {
  /** Stable provider id (e.g. "openai", "anthropic"). */
  readonly id: string;
  /** Generates a single response. Throws on failure; the router degrades gracefully. */
  generateResponse(input: ProviderInput): Promise<ProviderResult>;
}

/**
 * Raised for a provider that is known but cannot be used (e.g. the placeholder
 * Gemini adapter, or a real provider with no API key in production). The router
 * catches this and saves a user-safe system message; raw details stay server-side.
 */
export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}
