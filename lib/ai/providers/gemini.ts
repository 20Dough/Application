// Gemini provider adapter (Google Generative Language API).
//
// Uses the REST API directly via fetch, matching the OpenAI/Anthropic adapters.
// Falls back to a labeled mock response when no API key is configured so the
// app runs locally without keys.
//
// Gemini's API differs from the others in three ways, handled below:
//  - the system prompt is passed as `systemInstruction`, not a message
//  - turns live in `contents`, and the assistant role is "model" (not
//    "assistant"); the API has no "system" role
//  - the reply text is at candidates[0].content.parts[0].text

import type { AIProvider, GenerateResponseInput } from "@/lib/ai/types";
import { mockResponse } from "@/lib/ai/mock";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  async generateResponse(input: GenerateResponseInput): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return mockResponse("Gemini agent", "gemini", input);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      input.model,
    )}:generateContent`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: input.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
      }),
    });

    if (!res.ok) {
      // Log raw error server-side only; never expose it to the user.
      const detail = await res.text();
      console.error(`[gemini] ${res.status}: ${detail}`);
      throw new Error("Gemini request failed");
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }
}
