import type { AIProvider, ProviderInput, ProviderResult } from "@/lib/ai/types";

// Development stub provider.
//
// The collaboration loop (human → @mention → AI replies in-room) must be
// demonstrable locally and in automated runtime tests WITHOUT real API keys or
// network access. When a provider's API key is not configured (outside
// production), the factory returns this stub instead of the live adapter so the
// end-to-end flow still works and is testable.
//
// Its output is deterministic and clearly labelled as a local placeholder, so it
// can never be mistaken for a real model response. The reply is still attributed
// to the mentioned agent (the router saves it with that agent's id), so the UI
// shows the right teammate. Setting the provider's API key swaps in the real
// adapter automatically — no code changes.

export class StubProvider implements AIProvider {
  readonly id: string;
  private readonly envKey: string;

  constructor(providerId: string, envKey: string) {
    this.id = providerId;
    this.envKey = envKey;
  }

  async generateResponse(input: ProviderInput): Promise<ProviderResult> {
    // Echo the latest user turn so the reply is visibly grounded in the message
    // that triggered it — enough to prove routing and rendering end-to-end.
    const lastUser = [...input.messages]
      .reverse()
      .find((m) => m.role === "user");
    const prompt = lastUser?.content.trim() ?? "";
    const preview =
      prompt.length > 200 ? `${prompt.slice(0, 200)}…` : prompt || "(no message)";

    const content =
      `[local AI placeholder — set ${this.envKey} for a live ${this.id} response]\n\n` +
      `I received: "${preview}". Once a real API key is configured I'll respond for real.`;

    // Rough token estimate (~4 chars/token) purely for UsageLog shape parity.
    const inputChars = input.systemPrompt.length + prompt.length;
    return {
      content,
      inputTokens: Math.ceil(inputChars / 4),
      outputTokens: Math.ceil(content.length / 4),
    };
  }
}
