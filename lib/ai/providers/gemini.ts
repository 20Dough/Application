import {
  type AIProvider,
  type ProviderInput,
  type ProviderResult,
  ProviderUnavailableError,
} from "@/lib/ai/types";

// Gemini provider — placeholder. Listed in the registry for visibility but not
// yet wired to the Google API. It implements the common interface so the router
// treats it uniformly; calling it raises a user-safe unavailable error, which
// the router turns into a "could not respond" system message.

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";

  async generateResponse(_input: ProviderInput): Promise<ProviderResult> {
    throw new ProviderUnavailableError(
      "Gemini is not yet available. Use ARi (OpenAI) or Cloudy (Anthropic)."
    );
  }
}
