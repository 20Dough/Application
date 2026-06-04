// Server environment validation. Fails fast on missing required config and
// warns about optional integrations so misconfiguration surfaces at startup
// instead of as confusing runtime errors.

import { logger } from "@/lib/logger";

const REQUIRED = ["DATABASE_URL"] as const;

const OPTIONAL = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "SEARCH_API_KEY",
] as const;

export function validateServerEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them (see .env.example) before starting the server.`,
    );
  }

  const absent = OPTIONAL.filter((k) => !process.env[k]);
  if (absent.length > 0) {
    logger.warn(
      `Optional integrations disabled (no key set): ${absent.join(", ")}. ` +
        `These features fall back to mock responses.`,
    );
  }
}
