// Email sending — real delivery via the Resend HTTP API when RESEND_API_KEY is
// set, otherwise a console "mock" so the app runs locally with no email
// provider (matching the AI/search real-or-mock pattern).

import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Base URL used to build links in emails. */
export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "HiveMind <onboarding@resend.dev>";

  if (!apiKey) {
    // Mock: log enough to follow the flow (links included) without a provider.
    logger.info(`[email:mock] to=${message.to} subject="${message.subject}"`, {
      text: message.text,
    });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      logger.error(`[email] send failed (${res.status})`, {
        body: await res.text(),
      });
    }
  } catch (err) {
    // Never let a failed email break the request that triggered it.
    logger.error("[email] send threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
