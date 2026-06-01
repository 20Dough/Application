// Seed script — creates the canonical initial HiveMind team described in
// PROJECT_VISION.md: founder Van, with default agents ARi (OpenAI) and
// Cloudy (Anthropic). Run with: npm run db:seed

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Founder
  const van = await db.user.upsert({
    where: { email: "van@hivemind.dev" },
    update: {},
    create: { email: "van@hivemind.dev", name: "Van" },
  });

  // Workspace
  const workspace = await db.workspace.upsert({
    where: { id: "ws_ai_team_up" },
    update: {},
    create: {
      id: "ws_ai_team_up",
      name: "AI Team Up",
      description:
        "Building HiveMind — a human + AI team collaboration workspace.",
      ownerId: van.id,
    },
  });

  await db.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: van.id, workspaceId: workspace.id } },
    update: {},
    create: { userId: van.id, workspaceId: workspace.id, role: "owner" },
  });

  // Default agents
  const ari = await db.agent.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: "ari" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: "ari",
      displayName: "ARi",
      provider: "openai",
      model: "gpt-4o",
      role: "System Architect / Programmer",
      systemPrompt:
        "You are ARi, an AI system architect and programmer inside HiveMind. You represent the OpenAI / ChatGPT side of the team. You help users design systems, write code, debug, plan architecture, and turn ideas into working products. Be direct, practical, structured, and implementation-focused. You work well with Cloudy.",
      isActive: true,
    },
  });

  await db.agent.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: "cloudy" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: "cloudy",
      displayName: "Cloudy",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      role: "Deep Reasoning / Review Partner",
      systemPrompt:
        "You are Cloudy, a deep reasoning AI collaborator inside HiveMind. You represent the Claude AI / Anthropic side of the team. You review ideas, detect weaknesses, improve logic, refine plans, and explain complex systems clearly. You are careful, structured, and thoughtful. You work well with ARi.",
      isActive: true,
    },
  });

  // A starter room with ARi as the default agent
  const room = await db.room.upsert({
    where: { id: "room_app_dev" },
    update: {},
    create: {
      id: "room_app_dev",
      workspaceId: workspace.id,
      name: "App Development",
      description: "Designing and building the HiveMind MVP.",
      defaultAgentId: ari.id,
    },
  });

  // Add both default agents to the room
  for (const agentName of ["ari", "cloudy"]) {
    const agent = await db.agent.findUniqueOrThrow({
      where: { workspaceId_name: { workspaceId: workspace.id, name: agentName } },
    });
    await db.roomAgent.upsert({
      where: { roomId_agentId: { roomId: room.id, agentId: agent.id } },
      update: {},
      create: { roomId: room.id, agentId: agent.id },
    });
  }

  // Project context (higher priority than memory)
  await db.projectContext.upsert({
    where: { id: "ctx_mission" },
    update: {},
    create: {
      id: "ctx_mission",
      workspaceId: workspace.id,
      title: "Mission",
      content:
        "Turn vision into reality through human + AI teamwork. HiveMind is a shared workspace where human teams and AI teams collaborate inside project rooms.",
    },
  });

  console.log("✅ Seed complete: Van + ARi + Cloudy in 'AI Team Up'.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
