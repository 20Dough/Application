// Gemini provider — placeholder for future use.
//
// Returns a mock response for now. The interface is in place so a real Gemini
// adapter can be dropped in later without changing the AI Router.

import type { AIProvider, GenerateResponseInput } from "@/lib/ai/types";
import { mockResponse } from "@/lib/ai/mock";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  async generateResponse(input: GenerateResponseInput): Promise<string> {
    return mockResponse("Gemini agent", "gemini", input);
  }
}
