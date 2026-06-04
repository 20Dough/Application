import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  serverError,
  requireMembership,
  unauthorized,
} from "@/lib/api";
import { getWorkspaceBudget, getAppTokenStats } from "@/lib/tokens/budget";
import type { TokenInfo } from "@/types";

// GET /api/tokens?workspaceId= — the workspace's shared token pool + app stats.
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId is required");

    const role = await requireMembership(user.id, workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const [workspace, app] = await Promise.all([
      getWorkspaceBudget(workspaceId),
      getAppTokenStats(),
    ]);

    const info: TokenInfo = { workspace, app };
    return ok(info);
  } catch (err) {
    console.error("[GET /api/tokens]", err);
    return serverError();
  }
}
