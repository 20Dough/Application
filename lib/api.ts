import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";

// Shared helpers for API route handlers.

/**
 * Maps known error types to safe HTTP responses. Unknown errors are logged
 * server-side and returned as a generic 500 (never leak internals to clients).
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  console.error("[api] Unhandled error:", error);
  return NextResponse.json(
    { error: "Something went wrong" },
    { status: 500 }
  );
}

// Pragmatic email check — good enough to reject obvious typos without trying to
// fully validate RFC 5322. Real verification happens when email delivery lands.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalizes an email to a trimmed, lower-cased string. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True if the value looks like a valid email address. */
export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}
