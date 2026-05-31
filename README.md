# HiveMind — Human + AI Team Collaboration Workspace

HiveMind is a shared workspace where **multiple human users and multiple AI
agents work together as one team** to turn ideas into completed outcomes — think
Slack/Discord/Teams *plus* AI teammates, not a single-user chatbot. The formula
is **Human Team + AI Team + Shared Goal + Shared Workspace**.

Humans remain the owners of goals, decisions, and accountability; **AI agents are
teammates, not replacements.** Every workspace supports Human↔Human, Human↔AI,
and AI↔AI collaboration.

> Status: **MVP (v1.0)** — Phases 1–12 complete. Placeholder auth (single fixed
> dev user) and SQLite for local development. See [`docs/`](docs/) for the full
> vision, requirements, and architecture.

## The core collaboration loop

> Human sends a message → mentions an AI agent → the AI responds in the same
> room → human teammates see it → memory and decisions persist.

Everything else is built around making this loop work.

## Tech stack

- **Next.js** (App Router) + **React** + **TypeScript** + **Tailwind**
- **Next.js API routes** for the backend
- **Prisma** ORM — SQLite for dev, PostgreSQL-compatible for production
- AI **provider abstraction** (OpenAI, Anthropic, Gemini placeholder) behind a
  single `getProvider` factory; a local stub provider runs offline with no keys

## Quick start

```bash
cp .env.example .env            # AI keys optional; blank → local stub provider
npm install
export DATABASE_URL="file:./dev.db"
npx prisma generate
npx prisma db push              # create the SQLite dev database
npm run dev                     # http://localhost:3000
```

**No AI keys are required for development** — with `OPENAI_API_KEY` /
`ANTHROPIC_API_KEY` blank, the provider factory returns a local stub so the
collaboration loop works offline.

### Production build

```bash
npm run build && npm run start
```

> **Gotcha:** the stub provider is gated to non-production
> (`lib/ai/providers/index.ts`). Under `npm run start` (`NODE_ENV=production`)
> with no keys, the AI Router degrades gracefully instead of stubbing — so the
> runtime tests below must run against `npm run dev`.

## Verify

```bash
npm run typecheck               # tsc --noEmit
npm run build                   # next build
```

Phase-by-phase end-to-end **runtime tests** live in
[`scripts/runtime-tests/`](scripts/runtime-tests/) — see that folder's README
for the dev-server / fresh-DB requirements and the full phase list. Example:

```bash
DATABASE_URL="file:./dev.db" node scripts/runtime-tests/phase7-runtime-test.mjs
```

## Project layout

```
app/                 Next.js App Router — pages and API routes
  api/                 REST endpoints (workspaces, rooms, messages, agents,
                       memory, project-context, decisions, knowledge, discussions, …)
  workspace/[id]/      workspace pages (rooms, agents, members, memory, …)
components/          React UI, grouped by feature (agents, rooms/chat, memory,
                     decisions, discussions, knowledge, workspace, layout)
lib/                 Core logic, grouped by domain
  ai/                  AI Router, provider adapters, agent selection, embeddings
  memory/              context builder + memory validation
  agents/ rooms/ …     per-feature services and validation
  db.ts auth.ts …      shared infrastructure
prisma/              schema.prisma (data model)
scripts/runtime-tests/   per-phase end-to-end runtime tests
docs/                project vision, requirements, architecture, integration notes
```

## Documentation

| Doc | What it covers |
| --- | --- |
| [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md) | At-a-glance synthesis of the three source-of-truth docs below |
| [`docs/PROJECT_VISION.md`](docs/PROJECT_VISION.md) | Product vision, users, non-negotiable principles |
| [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md) | MVP scope and feature requirements |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, data model, AI Router design |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | Branch map, run/verify steps, last-known-good test counts |
| [`docs/CLEANUP_TASKS.md`](docs/CLEANUP_TASKS.md) | Post-MVP cleanup findings and follow-up tasks |
