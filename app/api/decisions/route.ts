import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  requireMembership,
  unauthorized,
  handleError,
} from "@/lib/api";
import { serializeDecision } from "@/lib/serialize";

// GET /api/decisions?workspaceId=
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId is required");

    const role = await requireMembership(user.id, workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const decisions = await db.decision.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return ok(decisions.map(serializeDecision));
  } catch (err) {
    return handleError("GET /api/decisions", err);
  }
}
