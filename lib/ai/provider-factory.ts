// Provider factory — resolves a provider name to its adapter.
//
// Unknown providers throw a safe server-side error.

import type { AIProvider } from "@/lib/ai/types";
import type { ProviderName } from "@/types";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { GeminiProvider } from "@/lib/ai/providers/gemini";

const providers: Record<ProviderName, AIProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider(),
};

export function getProvider(providerName: string): AIProvider {
  const provider = providers[providerName as ProviderName];
  if (!provider) {
    throw new Error(`Unknown AI provider: ${providerName}`);
  }
  return provider;
}
