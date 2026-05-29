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
