// Anthropic provider adapter (Cloudy).
//
// Uses the REST API directly via fetch. Falls back to a labeled mock response
// when no API key is configured so the app runs locally without keys.

import type { AIProvider, GenerateResponseInput } from "@/lib/ai/types";
import { mockResponse } from "@/lib/ai/mock";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;

  async generateResponse(input: GenerateResponseInput): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return mockResponse("Cloudy", "anthropic", input);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 1024,
        system: input.systemPrompt,
        messages: input.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[anthropic] ${res.status}: ${detail}`);
      throw new Error("Anthropic request failed");
    }

    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? "";
  }
}
