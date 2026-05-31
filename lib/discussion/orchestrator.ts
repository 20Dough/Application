import { db } from "@/lib/db";
import type { Room } from "@prisma/client";
import { getProvider } from "@/lib/ai/providers";
import {
  buildAgentContext,
  type ContextMessage,
  type RetrievedKnowledge,
} from "@/lib/memory/context-builder";
import { retrieveKnowledge } from "@/lib/knowledge/retrieval";
import { coerceDecisionFields, type DecisionFields } from "@/lib/decisions/validation";
import {
  coerceSynthesis,
  serializeConsensus,
  serializeDisagreements,
  MIN_AGENTS,
  type DiscussionStartRequest,
  type DiscussionSynthesis,
} from "@/lib/discussion/validation";

// Discussion orchestrator — drives a multi-agent discussion to completion.
//
// This reuses the existing AI orchestration building blocks rather than adding a
// second router: the provider factory (getProvider), the Context Builder
// (buildAgentContext — so every agent gets the same curated context as in chat),
// and Knowledge/RAG (retrieveKnowledge). It produces a structured artifact, not
// chat replies:
//
//   resolve participants → for each round, each agent contributes a turn that
//   sees the discussion so far → a synthesizer agent produces a neutral summary,
//   the consensus points, and the open disagreements → optionally a Decision.
//
// Design guarantees (mirrors the AI Router's):
//   - One agent failing a turn never aborts the discussion; that turn is skipped
//     and logged server-side. A discussion fails only if no turns are produced.
//   - Raw provider errors are logged server-side only, never returned to clients.
//   - Discussion runs synchronously in the MVP (like knowledge ingestion).

/**
 * Raised when a discussion can't proceed for an expected reason the caller
 * should see (too few agents, an invalid agent, every turn failing). The route
 * maps this to a 4xx with the message; unexpected errors stay 500.
 */
export class DiscussionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscussionError";
  }
}

type Participant = {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  model: string;
  systemPrompt: string;
};

// A generated turn before it is persisted.
type TurnDraft = {
  round: number;
  agentId: string;
  agentName: string;
  content: string;
  provider: string;
  model: string;
};

// The shared, curated context every participant's turn is grounded in. Loaded
// once per discussion (the topic is the retrieval query) and reused each round.
type SharedSources = {
  workspace: { name: string; description: string | null };
  room: { name: string; description: string | null };
  projectContexts: Array<{ title: string; content: string }>;
  memoryItems: Array<{ title: string; content: string; importance: number }>;
  decisions: Array<{ title: string; summary: string }>;
  knowledge: RetrievedKnowledge[];
};

/** A fully persisted discussion plus its turns, shaped for the client. */
export type DiscussionResult = {
  id: string;
  workspaceId: string;
  roomId: string;
  topic: string;
  rounds: number;
  status: string;
  summary: string;
  consensus: string[];
  disagreements: { point: string; positions: string }[];
  decisionId: string | null;
  createdAt: Date;
  turns: Array<{
    id: string;
    round: number;
    agentId: string;
    agentName: string;
    content: string;
    provider: string;
    model: string;
    createdAt: Date;
  }>;
};

/**
 * Runs a multi-agent discussion to completion and persists it (the Discussion
 * row plus every DiscussionTurn and the synthesis). Returns the full result.
 * Throws DiscussionError for user-facing failures and logs raw provider errors
 * server-side only.
 */
export async function runDiscussion(
  room: Room,
  request: DiscussionStartRequest,
  createdById: string | null
): Promise<DiscussionResult> {
  const participants = await loadParticipants(room, request.agentIds);
  const shared = await loadSharedSources(room, request.topic);

  // Create the record up front so turns can be attached as they are produced.
  const discussion = await db.discussion.create({
    data: {
      workspaceId: room.workspaceId,
      roomId: room.id,
      topic: request.topic,
      rounds: request.rounds,
      status: "completed",
      createdById,
    },
  });

  // --- Run the rounds ----------------------------------------------------
  const turns: TurnDraft[] = [];
  for (let round = 1; round <= request.rounds; round++) {
    for (const agent of participants) {
      const content = await generateTurn(
        agent,
        request.topic,
        round,
        request.rounds,
        shared,
        turns
      );
      if (content === null) continue; // failed turn — skipped and logged
      turns.push({
        round,
        agentId: agent.id,
        agentName: agent.displayName,
        content,
        provider: agent.provider,
        model: agent.model,
      });
    }
  }

  if (turns.length === 0) {
    // Every agent failed every round; record the failure and surface it.
    await db.discussion.update({
      where: { id: discussion.id },
      data: { status: "failed", error: "No agent was able to contribute." },
    });
    throw new DiscussionError(
      "The AI teammates could not contribute to this discussion right now. Please try again."
    );
  }

  await db.discussionTurn.createMany({
    data: turns.map((t) => ({ ...t, discussionId: discussion.id })),
  });

  // --- Synthesize: summary, consensus, disagreements ---------------------
  const synthesis = await synthesizeDiscussion(
    participants,
    room,
    request.topic,
    turns
  );

  const updated = await db.discussion.update({
    where: { id: discussion.id },
    data: {
      summary: synthesis.summary,
      consensus: serializeConsensus(synthesis.consensus),
      disagreements: serializeDisagreements(synthesis.disagreements),
    },
    include: { turns: { orderBy: { createdAt: "asc" } } },
  });

  return {
    id: updated.id,
    workspaceId: updated.workspaceId,
    roomId: updated.roomId,
    topic: updated.topic,
    rounds: updated.rounds,
    status: updated.status,
    summary: updated.summary ?? "",
    consensus: synthesis.consensus,
    disagreements: synthesis.disagreements,
    decisionId: updated.decisionId,
    createdAt: updated.createdAt,
    turns: updated.turns.map((t) => ({
      id: t.id,
      round: t.round,
      agentId: t.agentId,
      agentName: t.agentName,
      content: t.content,
      provider: t.provider,
      model: t.model,
      createdAt: t.createdAt,
    })),
  };
}

// --- One agent's turn ------------------------------------------------------

// Generates one agent's contribution for a round. Returns the text, or null if
// the provider failed (logged server-side; the discussion skips the turn).
async function generateTurn(
  agent: Participant,
  topic: string,
  round: number,
  totalRounds: number,
  shared: SharedSources,
  priorTurns: TurnDraft[]
): Promise<string | null> {
  try {
    const provider = getProvider(agent.provider);
    const context = buildAgentContext({
      agent: {
        id: agent.id,
        systemPrompt: discussionPersona(agent, topic, round, totalRounds),
      },
      workspace: shared.workspace,
      room: shared.room,
      projectContexts: shared.projectContexts,
      memoryItems: shared.memoryItems,
      decisions: shared.decisions,
      knowledge: shared.knowledge,
      messages: transcriptFor(agent, topic, priorTurns),
    });

    const result = await provider.generateResponse({
      model: agent.model,
      systemPrompt: context.systemPrompt,
      messages: context.messages,
    });
    const content = result.content.trim();
    return content || null;
  } catch (error) {
    console.error(
      `[discussion] ${agent.displayName} (${agent.provider}/${agent.model}) turn ${round} failed:`,
      error
    );
    return null;
  }
}

// Wraps the agent's persona with discussion-mode instructions for this round.
function discussionPersona(
  agent: Participant,
  topic: string,
  round: number,
  totalRounds: number
): string {
  return (
    `${agent.systemPrompt.trim()}\n\n` +
    `You are ${agent.displayName}, taking part in a structured discussion with ` +
    `other AI teammates in HiveMind.\n` +
    `Topic: "${topic}".\n` +
    `This is round ${round} of ${totalRounds}.\n` +
    `Read the discussion so far and add YOUR contribution in 2-5 sentences:\n` +
    `- Build on points you agree with and say why.\n` +
    `- Respectfully challenge points you disagree with.\n` +
    `- Raise considerations others have missed.\n` +
    `Speak only as yourself, in the first person. Do not summarize the whole ` +
    `thread, write other participants' lines, or try to close the discussion — ` +
    `just add your own contribution.`
  );
}

// Builds the transcript an agent sees: the topic as the opening turn, then every
// contribution so far. buildAgentContext maps this agent's own turns to
// "assistant" and the others to name-prefixed "user" turns, so each agent reads
// the discussion as a multi-party conversation it is part of.
function transcriptFor(
  agent: Participant,
  topic: string,
  priorTurns: TurnDraft[]
): ContextMessage[] {
  const messages: ContextMessage[] = [
    {
      senderType: "human",
      content: `Topic for discussion: ${topic}`,
      agentId: null,
      user: { name: "Facilitator", email: "" },
      agent: null,
    },
  ];
  for (const turn of priorTurns) {
    messages.push({
      senderType: "agent",
      content: turn.content,
      agentId: turn.agentId,
      user: null,
      agent: { displayName: turn.agentName },
    });
  }
  return messages;
}

// --- Synthesis -------------------------------------------------------------

// Produces the summary, consensus, and disagreements from the completed
// transcript. Uses the first participant as the synthesizer. Best-effort: if the
// provider fails or returns non-JSON, it degrades to a plain-text summary with
// empty consensus/disagreements (the turns remain the primary artifact).
async function synthesizeDiscussion(
  participants: Participant[],
  room: Room,
  topic: string,
  turns: TurnDraft[]
): Promise<DiscussionSynthesis> {
  const synthesizer = participants[0];
  const transcript = turns
    .map((t) => `${t.agentName} (round ${t.round}): ${t.content}`)
    .join("\n\n");

  try {
    const provider = getProvider(synthesizer.provider);
    const result = await provider.generateResponse({
      model: synthesizer.model,
      systemPrompt: buildSynthesisPrompt(synthesizer.displayName, topic, room.name),
      messages: [{ role: "user", content: transcript }],
    });
    const content = result.content.trim();
    const json = extractJsonObject(content);
    if (json) {
      return coerceSynthesis({
        summary: json.summary,
        consensus: json.consensus,
        disagreements: json.disagreements,
      });
    }
    // Plain-text fallback (e.g. the dev stub): use the reply as the summary.
    return coerceSynthesis({ summary: content, consensus: [], disagreements: [] });
  } catch (error) {
    console.error(
      `[discussion] synthesis via ${synthesizer.displayName} failed:`,
      error
    );
    return coerceSynthesis({
      summary:
        "A summary could not be generated automatically. See the discussion turns above.",
      consensus: [],
      disagreements: [],
    });
  }
}

function buildSynthesisPrompt(
  agentName: string,
  topic: string,
  roomName: string
): string {
  return (
    `You are ${agentName}, an AI teammate in HiveMind. You are synthesizing a ` +
    `multi-agent discussion from the room "${roomName}" on the topic ` +
    `"${topic}". Read the full transcript and produce an impartial synthesis.\n\n` +
    `Respond with ONLY a JSON object of this exact shape:\n` +
    `{"summary": "...", "consensus": ["..."], "disagreements": [{"point": "...", "positions": "..."}]}\n\n` +
    `- summary: 2-4 sentences neutrally capturing what was discussed.\n` +
    `- consensus: array of points the participants broadly agreed on (use [] if none).\n` +
    `- disagreements: array of objects; "point" is the contested question and ` +
    `"positions" describes who held which view (use [] if none).\n` +
    `Do not include any prose, markdown, or text outside the JSON object.`
  );
}

// ===========================================================================
// Decision generation from a discussion
// ===========================================================================

/** A generated, not-yet-persisted decision plus its provenance. */
export type DiscussionDecisionDraft = DecisionFields & {
  agentId: string;
  provider: string;
  model: string;
};

/**
 * Generates a Decision from a completed discussion: feeds the topic, synthesis,
 * and transcript to an agent and asks for a concrete decision and next steps.
 * Picks the room's default agent, else the first agent that authored a turn,
 * else any active workspace agent. The caller persists the returned draft and
 * links it back onto the discussion. Throws DiscussionError for user-facing
 * failures and logs raw provider errors server-side only.
 */
export async function generateDecisionFromDiscussion(
  room: Room,
  discussion: {
    id: string;
    topic: string;
    summary: string | null;
    consensus: string[];
    disagreements: { point: string; positions: string }[];
    turns: Array<{ agentName: string; round: number; content: string }>;
  }
): Promise<DiscussionDecisionDraft> {
  if (discussion.turns.length === 0) {
    throw new DiscussionError("This discussion has no content to decide from.");
  }

  const agent = await selectDecisionAgent(room, discussion.turns);

  const sections: string[] = [`Topic: ${discussion.topic}`];
  if (discussion.summary) sections.push(`Summary:\n${discussion.summary}`);
  if (discussion.consensus.length > 0) {
    sections.push(
      `Points of consensus:\n${discussion.consensus.map((c) => `- ${c}`).join("\n")}`
    );
  }
  if (discussion.disagreements.length > 0) {
    sections.push(
      `Open disagreements:\n${discussion.disagreements
        .map((d) => `- ${d.point}${d.positions ? ` (${d.positions})` : ""}`)
        .join("\n")}`
    );
  }
  sections.push(
    `Full discussion:\n${discussion.turns
      .map((t) => `${t.agentName} (round ${t.round}): ${t.content}`)
      .join("\n\n")}`
  );

  let content: string;
  try {
    const provider = getProvider(agent.provider);
    const result = await provider.generateResponse({
      model: agent.model,
      systemPrompt: buildDecisionPrompt(agent.displayName, discussion.topic),
      messages: [{ role: "user", content: sections.join("\n\n") }],
    });
    content = result.content.trim();
    if (!content) throw new Error("Provider returned an empty decision");
  } catch (error) {
    console.error(
      `[discussion] decision via ${agent.displayName} (${agent.provider}/${agent.model}) failed:`,
      error
    );
    throw new DiscussionError(
      "The AI teammate could not turn this discussion into a decision right now. Please try again."
    );
  }

  const fields = parseDecisionContent(content);
  return { ...fields, agentId: agent.id, provider: agent.provider, model: agent.model };
}

function buildDecisionPrompt(agentName: string, topic: string): string {
  return (
    `You are ${agentName}, an AI teammate in HiveMind. Below is a multi-agent ` +
    `discussion on "${topic}". Turn it into a concrete DECISION: what the team ` +
    `should do given the discussion, plus the next steps.\n\n` +
    `Respond with ONLY a JSON object of this exact shape:\n` +
    `{"title": "...", "summary": "...", "actionItems": ["...", "..."]}\n\n` +
    `- title: a short headline naming the decision.\n` +
    `- summary: 1-3 sentences on what is decided and why, acknowledging any ` +
    `unresolved disagreement.\n` +
    `- actionItems: array of short next-step strings (use [] if there are none).\n` +
    `Do not include any prose, markdown, or text outside the JSON object.`
  );
}

// --- Shared helpers --------------------------------------------------------

// Resolves the participating agents. Explicit agentIds must each be an active
// agent in this workspace (order preserved); otherwise the room's active agents
// are used. Requires at least MIN_AGENTS to make a discussion agent-to-agent.
async function loadParticipants(
  room: Room,
  agentIds: string[]
): Promise<Participant[]> {
  let participants: Participant[];

  if (agentIds.length > 0) {
    const found = await db.agent.findMany({
      where: { id: { in: agentIds }, workspaceId: room.workspaceId },
    });
    const byId = new Map(found.map((a) => [a.id, a]));
    participants = [];
    for (const id of agentIds) {
      const agent = byId.get(id);
      if (!agent) {
        throw new DiscussionError("One of the selected agents is not in this workspace.");
      }
      if (!agent.isActive) {
        throw new DiscussionError(`${agent.displayName} is inactive.`);
      }
      participants.push(toParticipant(agent));
    }
  } else {
    const links = await db.roomAgent.findMany({
      where: { roomId: room.id },
      include: { agent: true },
      orderBy: { createdAt: "asc" },
    });
    participants = links
      .map((l) => l.agent)
      .filter((a) => a.isActive)
      .map(toParticipant);
  }

  if (participants.length < MIN_AGENTS) {
    throw new DiscussionError(
      `A discussion needs at least ${MIN_AGENTS} active AI agents. Add agents to the room or select more.`
    );
  }
  return participants;
}

// Picks the agent that authors a decision: the room's default agent (if active),
// else the first agent that spoke in the discussion (if still active), else any
// active workspace agent.
async function selectDecisionAgent(
  room: Room,
  turns: Array<{ agentName: string }>
): Promise<Participant> {
  if (room.defaultAgentId) {
    const def = await db.agent.findFirst({
      where: { id: room.defaultAgentId, workspaceId: room.workspaceId, isActive: true },
    });
    if (def) return toParticipant(def);
  }

  const firstSpeaker = turns[0]?.agentName;
  if (firstSpeaker) {
    const byName = await db.agent.findFirst({
      where: { workspaceId: room.workspaceId, displayName: firstSpeaker, isActive: true },
    });
    if (byName) return toParticipant(byName);
  }

  const anyActive = await db.agent.findFirst({
    where: { workspaceId: room.workspaceId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!anyActive) {
    throw new DiscussionError("No active AI teammate is available to generate a decision.");
  }
  return toParticipant(anyActive);
}

async function loadSharedSources(room: Room, query: string): Promise<SharedSources> {
  const [workspace, projectContexts, memoryItems, decisions, knowledge] =
    await Promise.all([
      db.workspace.findUniqueOrThrow({
        where: { id: room.workspaceId },
        select: { name: true, description: true },
      }),
      db.projectContext.findMany({
        where: { workspaceId: room.workspaceId },
        select: { title: true, content: true },
        orderBy: { createdAt: "asc" },
      }),
      db.memoryItem.findMany({
        where: {
          workspaceId: room.workspaceId,
          OR: [{ roomId: null }, { roomId: room.id }],
        },
        select: { title: true, content: true, importance: true },
        orderBy: { importance: "desc" },
      }),
      db.decision.findMany({
        where: {
          workspaceId: room.workspaceId,
          OR: [{ roomId: null }, { roomId: room.id }],
        },
        select: { title: true, summary: true },
        orderBy: { createdAt: "desc" },
      }),
      loadRelevantKnowledge(room, query),
    ]);
  return {
    workspace,
    room: { name: room.name, description: room.description },
    projectContexts,
    memoryItems,
    decisions,
    knowledge,
  };
}

// Best-effort knowledge retrieval — failures degrade to "no knowledge" so an
// embedding/db hiccup never blocks a discussion. Mirrors the AI Router.
async function loadRelevantKnowledge(
  room: Room,
  query: string
): Promise<RetrievedKnowledge[]> {
  try {
    const chunks = await retrieveKnowledge({
      workspaceId: room.workspaceId,
      roomId: room.id,
      query,
    });
    return chunks.map((c) => ({ sourceTitle: c.sourceTitle, content: c.content }));
  } catch (error) {
    console.error("[discussion] knowledge retrieval failed:", error);
    return [];
  }
}

function toParticipant(agent: {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  model: string;
  systemPrompt: string;
}): Participant {
  return {
    id: agent.id,
    name: agent.name,
    displayName: agent.displayName,
    provider: agent.provider,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
  };
}

// Parses provider output into bounded decision fields. Prefers a JSON object;
// falls back to using plain text as the summary so a Decision is still produced
// (mirrors the AI Router's decision-summary parsing).
function parseDecisionContent(content: string): DecisionFields {
  const json = extractJsonObject(content);
  if (json) {
    return coerceDecisionFields({
      title: json.title,
      summary: json.summary,
      actionItems: json.actionItems,
    });
  }
  const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean);
  return coerceDecisionFields({ title: firstLine, summary: content, actionItems: [] });
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  const unfenced = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
