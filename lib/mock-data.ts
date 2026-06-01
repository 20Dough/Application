// Mock data for the MVP UI. This stands in for real database queries until the
// API + AI Router layers are wired up. It mirrors the canonical initial
// HiveMind team described in PROJECT_VISION.md (Van + ARi + Cloudy).

import type {
  Agent,
  Decision,
  MemoryItem,
  Message,
  ProjectContext,
  Room,
  User,
  Workspace,
  WorkspaceMember,
} from "@/types";

export const mockUser: User = {
  id: "user_van",
  email: "van@hivemind.dev",
  name: "Van",
  avatarUrl: null,
  createdAt: "2026-05-01T09:00:00.000Z",
  updatedAt: "2026-05-01T09:00:00.000Z",
};

export const mockWorkspace: Workspace = {
  id: "ws_ai_team_up",
  name: "AI Team Up",
  description: "Building HiveMind — a human + AI team collaboration workspace.",
  ownerId: mockUser.id,
  createdAt: "2026-05-01T09:00:00.000Z",
  updatedAt: "2026-05-20T09:00:00.000Z",
};

export const mockMembers: WorkspaceMember[] = [
  {
    id: "wm_van",
    userId: "user_van",
    workspaceId: mockWorkspace.id,
    role: "owner",
    createdAt: "2026-05-01T09:00:00.000Z",
    user: mockUser,
  },
  {
    id: "wm_nattanid",
    userId: "user_nattanid",
    workspaceId: mockWorkspace.id,
    role: "admin",
    createdAt: "2026-05-02T09:00:00.000Z",
    user: {
      id: "user_nattanid",
      email: "nattanid@hivemind.dev",
      name: "Nattanid",
      createdAt: "2026-05-02T09:00:00.000Z",
      updatedAt: "2026-05-02T09:00:00.000Z",
    },
  },
  {
    id: "wm_alice",
    userId: "user_alice",
    workspaceId: mockWorkspace.id,
    role: "member",
    createdAt: "2026-05-03T09:00:00.000Z",
    user: {
      id: "user_alice",
      email: "alice@hivemind.dev",
      name: "Alice",
      createdAt: "2026-05-03T09:00:00.000Z",
      updatedAt: "2026-05-03T09:00:00.000Z",
    },
  },
];

export const mockAgents: Agent[] = [
  {
    id: "agent_ari",
    workspaceId: mockWorkspace.id,
    name: "ari",
    displayName: "ARi",
    provider: "openai",
    model: "gpt-4o",
    role: "System Architect / Programmer",
    systemPrompt:
      "You are ARi, an AI system architect and programmer inside HiveMind. You represent the OpenAI / ChatGPT side of the team.",
    avatarUrl: null,
    isActive: true,
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z",
  },
  {
    id: "agent_cloudy",
    workspaceId: mockWorkspace.id,
    name: "cloudy",
    displayName: "Cloudy",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    role: "Deep Reasoning / Review Partner",
    systemPrompt:
      "You are Cloudy, a deep reasoning AI collaborator inside HiveMind. You represent the Claude AI / Anthropic side of the team.",
    avatarUrl: null,
    isActive: true,
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z",
  },
  {
    id: "agent_researcher",
    workspaceId: mockWorkspace.id,
    name: "researcher",
    displayName: "Researcher",
    provider: "gemini",
    model: "gemini-pro",
    role: "Research / Discovery",
    systemPrompt:
      "You are Researcher, an AI research assistant inside HiveMind. You gather, summarize, and validate information for the team.",
    avatarUrl: null,
    isActive: false,
    createdAt: "2026-05-05T09:00:00.000Z",
    updatedAt: "2026-05-05T09:00:00.000Z",
  },
];

export const mockRooms: Room[] = [
  {
    id: "room_app_dev",
    workspaceId: mockWorkspace.id,
    name: "App Development",
    description: "Designing and building the HiveMind MVP.",
    defaultAgentId: "agent_ari",
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-20T09:00:00.000Z",
  },
  {
    id: "room_general",
    workspaceId: mockWorkspace.id,
    name: "General",
    description: "Team-wide discussion.",
    defaultAgentId: null,
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-05-18T09:00:00.000Z",
  },
  {
    id: "room_product",
    workspaceId: mockWorkspace.id,
    name: "Product Planning",
    description: "Roadmap, priorities, and product decisions.",
    defaultAgentId: "agent_cloudy",
    createdAt: "2026-05-06T09:00:00.000Z",
    updatedAt: "2026-05-19T09:00:00.000Z",
  },
];

export const mockMessages: Message[] = [
  {
    id: "msg_1",
    roomId: "room_app_dev",
    senderType: "human",
    userId: "user_van",
    content:
      "Welcome to App Development! Let's get the HiveMind MVP shaped up. @ARi design the database and @Cloudy review the architecture.",
    senderName: "Van",
    createdAt: "2026-05-20T10:00:00.000Z",
    metadata: {
      mentionedAgentIds: ["agent_ari", "agent_cloudy"],
      rawMentions: ["ari", "cloudy"],
    },
  },
  {
    id: "msg_2",
    roomId: "room_app_dev",
    senderType: "agent",
    agentId: "agent_ari",
    senderName: "ARi",
    agentRole: "System Architect / Programmer",
    content:
      "On it. I'd start with core entities: User, Workspace, Room, Message, Agent, plus join tables for membership and room agents. SQLite for dev, Postgres-compatible schema for prod. I'll keep senderType on Message so humans, agents, and system events share one timeline.",
    createdAt: "2026-05-20T10:01:00.000Z",
    metadata: { provider: "openai", model: "gpt-4o" },
  },
  {
    id: "msg_3",
    roomId: "room_app_dev",
    senderType: "agent",
    agentId: "agent_cloudy",
    senderName: "Cloudy",
    agentRole: "Deep Reasoning / Review Partner",
    content:
      "Solid foundation. One refinement: keep ProjectContext separate from MemoryItem so the workspace's stable mission always outranks smaller facts when we build AI context. Also make sure metadata can hold mention + provider info for future AI-to-AI delegation.",
    createdAt: "2026-05-20T10:02:30.000Z",
    metadata: { provider: "anthropic", model: "claude-sonnet-4-6" },
  },
  {
    id: "msg_4",
    roomId: "room_app_dev",
    senderType: "human",
    userId: "user_nattanid",
    senderName: "Nattanid",
    content:
      "Love this. Can we make sure the right panel shows agents, memory, and decisions so the room feels like a real command center?",
    createdAt: "2026-05-20T10:05:00.000Z",
  },
  {
    id: "msg_5",
    roomId: "room_app_dev",
    senderType: "system",
    content: "Researcher is currently inactive and will not respond.",
    createdAt: "2026-05-20T10:06:00.000Z",
  },
];

export const mockProjectContext: ProjectContext[] = [
  {
    id: "ctx_mission",
    workspaceId: mockWorkspace.id,
    title: "Mission",
    content:
      "Turn vision into reality through human + AI teamwork. HiveMind is a shared workspace where human teams and AI teams collaborate inside project rooms.",
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z",
  },
  {
    id: "ctx_principle",
    workspaceId: mockWorkspace.id,
    title: "Non-negotiable",
    content:
      "AI agents are database-driven. The frontend never calls AI providers directly. Collaboration comes before advanced features.",
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z",
  },
];

export const mockMemory: MemoryItem[] = [
  {
    id: "mem_stack",
    workspaceId: mockWorkspace.id,
    roomId: "room_app_dev",
    title: "Tech stack",
    content: "Next.js App Router + TypeScript + Tailwind + Prisma + SQLite (dev).",
    importance: 3,
    createdAt: "2026-05-10T09:00:00.000Z",
    updatedAt: "2026-05-10T09:00:00.000Z",
  },
  {
    id: "mem_team",
    workspaceId: mockWorkspace.id,
    roomId: null,
    title: "Initial team",
    content: "Van (founder), ARi (OpenAI architect), Cloudy (Anthropic reviewer).",
    importance: 2,
    createdAt: "2026-05-10T09:00:00.000Z",
    updatedAt: "2026-05-10T09:00:00.000Z",
  },
];

export const mockDecisions: Decision[] = [
  {
    id: "dec_db",
    workspaceId: mockWorkspace.id,
    roomId: "room_app_dev",
    title: "Database approach",
    summary:
      "Use Prisma with SQLite for development and a PostgreSQL-compatible schema for production. Core entities defined; ProjectContext kept separate from MemoryItem.",
    actionItems: [
      "Finalize Prisma schema",
      "Seed default agents ARi and Cloudy",
      "Wire AI Router before adding advanced features",
    ],
    createdAt: "2026-05-20T10:10:00.000Z",
  },
];
