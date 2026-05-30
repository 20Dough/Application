import OpenAI from "openai";
import type { AIProvider, ProviderInput, ProviderResult } from "@/lib/ai/types";

// OpenAI provider adapter (powers ARi). Server-side only — the API key never
// leaves the backend. Used by the factory when OPENAI_API_KEY is configured;
// otherwise the local stub is used so the loop still works in dev.

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(input: ProviderInput): Promise<ProviderResult> {
    const completion = await this.client.chat.completions.create({
      model: input.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    return {
      content,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
    };
  }
}
