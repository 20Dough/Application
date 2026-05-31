// Shared client types for the discussions UI.

export type Disagreement = {
  point: string;
  positions: string;
};

// A discussion as returned by the list endpoint (no turns; carries a count).
export type DiscussionListItem = {
  id: string;
  roomId: string;
  topic: string;
  rounds: number;
  status: string;
  summary: string;
  consensus: string[];
  disagreements: Disagreement[];
  decisionId: string | null;
  turnCount: number;
  createdAt: string;
};

// One agent's contribution in a discussion.
export type DiscussionTurn = {
  id: string;
  round: number;
  agentId: string;
  agentName: string;
  content: string;
  provider: string;
  model: string;
  createdAt: string;
};

// A discussion with its full turns (the detail / just-created shape).
export type DiscussionDetail = {
  id: string;
  roomId: string;
  topic: string;
  rounds: number;
  status: string;
  summary: string;
  consensus: string[];
  disagreements: Disagreement[];
  decisionId: string | null;
  createdAt: string;
  turns: DiscussionTurn[];
};
