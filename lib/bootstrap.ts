// Ensures the canonical default workspace exists (Van + ARi + Cloudy + a
// starter room) so the app is usable immediately on a fresh database. This is
// the same data as prisma/seed.ts but runs on demand from the bootstrap route.

import { db } from "@/lib/db";

export async function ensureDefaultWorkspace(userId: string) {
  // If the user already belongs to a workspace, use the most recent one.
  const existing = await db.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing.workspace;

  const workspace = await db.workspace.create({
    data: {
      name: "AI Team Up",
      description:
        "Building HiveMind — a human + AI team collaboration workspace.",
      ownerId: userId,
      members: { create: { userId, role: "owner" } },
    },
  });

  const ari = await db.agent.create({
    data: {
      workspaceId: workspace.id,
      name: "ari",
      displayName: "ARi",
      provider: "openai",
      model: "gpt-4o",
      role: "System Architect / Programmer",
      systemPrompt:
        "You are ARi, an AI system architect and programmer inside HiveMind. You represent the OpenAI / ChatGPT side of the team. You help users design systems, write code, debug, plan architecture, and turn ideas into working products. Be direct, practical, structured, and implementation-focused. You work well with Cloudy.",
    },
  });

  const cloudy = await db.agent.create({
    data: {
      workspaceId: workspace.id,
      name: "cloudy",
      displayName: "Cloudy",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      role: "Deep Reasoning / Review Partner",
      systemPrompt:
        "You are Cloudy, a deep reasoning AI collaborator inside HiveMind. You represent the Claude AI / Anthropic side of the team. You review ideas, detect weaknesses, improve logic, refine plans, and explain complex systems clearly. You are careful, structured, and thoughtful. You work well with ARi.",
    },
  });

  const room = await db.room.create({
    data: {
      workspaceId: workspace.id,
      name: "App Development",
      description: "Designing and building the HiveMind MVP.",
      defaultAgentId: ari.id,
      roomAgents: {
        create: [{ agentId: ari.id }, { agentId: cloudy.id }],
      },
    },
  });

  await db.message.create({
    data: {
      roomId: room.id,
      senderType: "system",
      content:
        "Welcome to HiveMind! Mention @ARi or @Cloudy to bring an AI teammate into the conversation.",
    },
  });

  await db.projectContext.create({
    data: {
      workspaceId: workspace.id,
      title: "Mission",
      content:
        "Turn vision into reality through human + AI teamwork. HiveMind is a shared workspace where human teams and AI teams collaborate inside project rooms.",
    },
  });

  return workspace;
}
