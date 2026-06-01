// Shared mock response used when an AI provider has no API key configured.
// Lets the full collaboration loop (mention → route → respond → save) run
// locally with zero external dependencies.

import type { GenerateResponseInput } from "@/lib/ai/types";
import type { ProviderName } from "@/types";

export function mockResponse(
  displayName: string,
  provider: ProviderName,
  input: GenerateResponseInput,
): string {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const snippet = lastUser?.content?.slice(0, 140) ?? "";
  return [
    `(${displayName} — mock reply via ${provider}/${input.model}.`,
    `No ${provider.toUpperCase()}_API_KEY set, so this is a placeholder.)`,
    snippet ? `\n\nYou said: "${snippet}"` : "",
  ].join(" ");
}
