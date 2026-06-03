// Gemini provider adapter.
//
// Uses the Generative Language REST API when GEMINI_API_KEY is set; otherwise
// falls back to a labeled mock response so the app runs locally without a key.

import type { AIProvider, GenerateResponseInput } from "@/lib/ai/types";
import { mockResponse } from "@/lib/ai/mock";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  async generateResponse(input: GenerateResponseInput): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return mockResponse("Gemini agent", "gemini", input);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      input.model,
    )}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents: input.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
      }),
    });

    if (!res.ok) {
      console.error(`[gemini] ${res.status}: ${await res.text()}`);
      throw new Error("Gemini request failed");
    }

    const data = await res.json();
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
    );
  }
}
