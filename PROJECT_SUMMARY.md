# HiveMind — Project Summary

A concise synthesis of `PROJECT_VISION.md`, `PRODUCT_REQUIREMENTS.md`, and `ARCHITECTURE.md`. Those three files remain the source of truth; this is the at-a-glance overview.

## 1. Product Vision

HiveMind is a **Human + AI Team Collaboration Workspace**: shared project rooms where multiple human users and multiple AI agents work together as one team to turn ideas into completed outcomes. The formula is **Human Team + AI Team + Shared Goal + Shared Workspace**.

It is explicitly *not* a single-user chatbot, a knowledge base, a CRUD/Notion clone, or a model-comparison playground. It should feel like Slack/Discord/Teams *plus* AI teammates — a project command center.

**North Star:** turn vision into reality through human + AI teamwork.

## 2. Target Users

- **University students** — assignments, group projects, research, presentations; need structure, work division, and execution help.
- **Creators** — strong ideas (brand, book, channel, app, product) but struggle with execution.
- **Founders / vision-driven people** — have a vision before a team; need an early-stage "AI team" to clarify, plan, and de-risk.

## 3. Core Collaboration Loop

Human sends message → mentions an AI agent → AI responds in the same room → human teammates see it → memory and decisions persist. **This loop must work before any advanced feature is built.**

## 4. Human Roles

Workspace membership with role-based permissions:

- **Owner** — manages everything (users, rooms, agents, memory, context).
- **Admin** — manages rooms, agents, memory; invites users.
- **Member** — chats, mentions AI agents, views memory, generates summaries.
- **Viewer** — read-only; cannot message or call AI.

Invitations are stored in the DB (email + role + pending/accepted/rejected status); actual email sending is deferred.

## 5. AI Roles

AI agents are **database-driven teammates**, not hard-coded logic. A stable user-facing **identity** is separated from the underlying **provider/model**, so models can be upgraded without changing the teammate. Default agents per workspace:

- **ARi** — OpenAI side; System Architect / Programmer / Builder.
- **Cloudy** — Anthropic side; Deep Reasoning / Review Partner.

Mention rules drive responses: one mention → that agent; multiple → all mentioned; none → room default → fallback to ARi; inactive agents skip; one provider failing must not block the others. MVP supports Human→AI mentions; metadata is designed to later support AI→AI and AI→Human.

## 6. Database Entities

`User`, `Workspace`, `WorkspaceMember` (unique userId+workspaceId), `Invitation`, `Room`, `Message` (senderType: human/agent/system), `Agent` (unique workspaceId+name), `RoomAgent` (unique roomId+agentId), `MemoryItem`, `ProjectContext`, `Decision`, `UsageLog`. Modeled in Prisma — SQLite for dev, PostgreSQL-compatible for production. **ProjectContext is separate from MemoryItem** and takes higher priority in context building.

## 7. System Architecture

Layered flow: **Frontend → Next.js API Routes → Workspace/Room/Message Services → AI Router → Provider Adapters → External AI Providers.**

- **Stack:** Next.js App Router, React, TypeScript, Tailwind, shadcn/ui; Next.js API routes; Prisma; placeholder auth (future Clerk); fetch-based (future realtime).
- **AI Router** (`lib/ai/ai-router.ts`) is the single place for orchestration: save message → load room/workspace/agents → parse mentions → select agents → build context → call providers → save responses. Frontend never calls AI providers directly.
- **Provider abstraction** — common `AIProvider.generateResponse(input)` interface; OpenAI, Anthropic, Gemini (placeholder) via a `getProvider` factory.
- **Context builder** priority: system prompt → ProjectContext → workspace → room → important memory → recent decisions → recent messages (latest ~30) → current message.
- **UI:** left sidebar (workspace, rooms, members) · center (chat + mention input) · right panel (agents, project context, memory, decisions); clean, dark-mode-first.
- **Security:** keys server-side only, membership/role checks, sanitize input, never expose raw provider errors.

## 8. MVP Scope

Prove the core experience: create workspace → create room → add humans + ARi/Cloudy → send messages → mention agents (single, multiple, case-insensitive) → correct agents respond in-room → shared memory, project context, and decision summaries persist. App runs locally with SQLite and placeholder auth, no production services required.

**Core MVP features:** Workspace, Room, Human Chat, Human Collaboration, AI Agent System, Mention System, AI Router, Provider Abstraction, Shared Memory, Project Context, Decision Summary, Basic UI. Build order spans 12 phases from setup/schema through to polish and deploy prep — collaboration loop first.

## 9. Future Roadmap

- Full **AI→AI orchestration** (agents auto-invite other agents); AI→Human and Human→Human mentions.
- **Human user mentions** in the parser.
- Additional providers: Gemini, Perplexity, Mistral, DeepSeek, local/company models.
- **Realtime** via Socket.io or Supabase Realtime.
- **Clerk** authentication.
- Production deployment on Vercel + Supabase/Neon.
- Long-term: become the default workspace for human + AI teams.

## 10. Risks and Assumptions

- **Scope drift** — biggest risk is degenerating into a plain chatbot, knowledge base, or model-comparison tool; the non-negotiable rules and collaboration-first priority exist to prevent this.
- **Architecture discipline** — agents must stay DB-driven and routed through the AI Router; ProjectContext must remain distinct from MemoryItem.
- **Provider reliability** — partial failures must degrade gracefully (other agents still respond) without exposing raw errors.
- **Assumptions** — placeholder auth and SQLite are acceptable for MVP; identity/provider separation holds across model upgrades; curated, bounded context (not unlimited history) keeps AI responses relevant and costs controlled.
