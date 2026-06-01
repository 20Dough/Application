// Common provider interface (Phase 6 — Provider Abstraction Layer).
//
// Every AI provider implements the same shape so new models/providers can be
// added without touching the AI Router. The router talks to this interface;
// it never knows which concrete provider it's calling.

import type { ProviderName } from "@/types";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateResponseInput {
  model: string;
  systemPrompt: string;
  messages: AIMessage[];
}

export interface AIProvider {
  readonly name: ProviderName;
  generateResponse(input: GenerateResponseInput): Promise<string>;
}
