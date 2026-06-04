// Small helpers for API route handlers — consistent JSON responses and
// membership guards.

import { NextResponse } from "next/server";
import { getMemberRole } from "@/lib/permissions";
import { captureException } from "@/lib/logger";
import type { WorkspaceRole } from "@/types";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Not authenticated") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function tooManyRequests(
  retryAfter: number,
  message = "Too many requests",
) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** Log an unexpected error and return a 500. Use in route catch blocks. */
export function handleError(scope: string, error: unknown) {
  captureException(scope, error);
  return serverError();
}

/** Ensure a user is a member of a workspace and optionally meets a min role. */
export async function requireMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  return getMemberRole(userId, workspaceId);
}
