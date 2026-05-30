import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { retrieveKnowledge } from "@/lib/knowledge/retrieval";

// GET /api/knowledge/search?workspaceId=&q=[&roomId=]
// Retrieves the knowledge passages most relevant to a query within a scope — the
// same retrieval the AI Router runs before answering. Any member may search (it
// reads only knowledge they can already see). Useful for a UI preview ("what
// would the AI find for this question?") and for verifying retrieval directly.
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const params = request.nextUrl.searchParams;
    const workspaceId = params.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    await requireWorkspaceMember(user.id, workspaceId);

    const query = (params.get("q") ?? "").trim();
    if (!query) {
      return NextResponse.json({ error: "q (query) is required" }, { status: 400 });
    }

    const roomId = params.get("roomId");
    const results = await retrieveKnowledge({ workspaceId, roomId, query });

    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error);
  }
}
