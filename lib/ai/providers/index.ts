import { type AIProvider, ProviderUnavailableError } from "@/lib/ai/types";
import { isKnownProvider } from "@/lib/agents/registry";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { StubProvider } from "./stub";

// Provider factory — the single place that maps a provider id to a concrete
// adapter. The AI Router asks for an agent's provider here and never constructs
// adapters directly, so provider wiring (keys, stubs, new providers) is isolated.
//
// Resolution rules per provider:
//   - Real key configured        → the live adapter (real API calls).
//   - No key, not production      → the local StubProvider (keeps the loop
//                                    working in dev/tests without secrets).
//   - No key, production          → ProviderUnavailableError (degrade gracefully
//                                    rather than pretend; the router saves a
//                                    "could not respond" system message).
//   - Placeholder provider (gemini) → its own adapter, which is unavailable.
//   - Unknown provider id         → throws (caught and logged server-side).

// Real adapters that depend on an API key, with the env var that configures them.
const KEYED_PROVIDERS: Record<
  string,
  { envKey: string; build: (apiKey: string) => AIProvider }
> = {
  openai: {
    envKey: "OPENAI_API_KEY",
    build: (apiKey) => new OpenAIProvider(apiKey),
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    build: (apiKey) => new AnthropicProvider(apiKey),
  },
};

/**
 * Returns the provider adapter for a provider id. Throws for unknown providers
 * and (in production) for keyed providers with no API key. Never returns null.
 */
export function getProvider(providerId: string): AIProvider {
  if (!isKnownProvider(providerId)) {
    throw new Error(`Unknown AI provider: ${providerId}`);
  }

  // Placeholder providers have dedicated adapters.
  if (providerId === "gemini") {
    return new GeminiProvider();
  }

  const keyed = KEYED_PROVIDERS[providerId];
  if (keyed) {
    const apiKey = process.env[keyed.envKey]?.trim();
    if (apiKey) {
      return keyed.build(apiKey);
    }
    if (process.env.NODE_ENV === "production") {
      throw new ProviderUnavailableError(
        `${providerId} is not configured (${keyed.envKey} is missing).`
      );
    }
    // Dev / test: keep the collaboration loop working without secrets.
    return new StubProvider(providerId, keyed.envKey);
  }

  // Known in the registry but no adapter wired (shouldn't happen).
  throw new ProviderUnavailableError(`${providerId} is not available yet.`);
}
