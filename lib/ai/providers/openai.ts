// OpenAI provider adapter (ARi).
//
// Uses the REST API directly via fetch to avoid an SDK dependency for the MVP.
// If no API key is configured, falls back to a clearly-labeled mock response so
// the app keeps working locally (per the development mode rules).

import type { AIProvider, GenerateResponseInput } from "@/lib/ai/types";
import { mockResponse } from "@/lib/ai/mock";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;

  async generateResponse(input: GenerateResponseInput): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return mockResponse("ARi", "openai", input);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          ...input.messages,
        ],
      }),
    });

    if (!res.ok) {
      // Log raw error server-side only; never expose it to the user.
      const detail = await res.text();
      console.error(`[openai] ${res.status}: ${detail}`);
      throw new Error("OpenAI request failed");
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }
}
