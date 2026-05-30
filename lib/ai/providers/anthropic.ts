import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  ProviderInput,
  ProviderMessage,
  ProviderResult,
} from "@/lib/ai/types";

// Anthropic provider adapter (powers Cloudy). Server-side only. Used by the
// factory when ANTHROPIC_API_KEY is configured; otherwise the local stub runs.

// Anthropic requires a max output budget and an alternating user/assistant
// transcript that begins with a user turn. A HiveMind room can have several
// humans posting in a row, so we coalesce consecutive same-role turns and drop
// any leading assistant turns before sending.
const MAX_TOKENS = 1024;

function normalizeForAnthropic(messages: ProviderMessage[]): ProviderMessage[] {
  const coalesced: ProviderMessage[] = [];
  for (const m of messages) {
    const last = coalesced[coalesced.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      coalesced.push({ role: m.role, content: m.content });
    }
  }
  while (coalesced.length > 0 && coalesced[0].role === "assistant") {
    coalesced.shift();
  }
  return coalesced;
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(input: ProviderInput): Promise<ProviderResult> {
    const messages = normalizeForAnthropic(input.messages);
    const response = await this.client.messages.create({
      model: input.model,
      system: input.systemPrompt,
      max_tokens: MAX_TOKENS,
      messages,
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return {
      content,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  }
}
