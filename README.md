# HiveMind

> Human + AI Team Collaboration Workspace — a shared space where teams of humans and teams of AI work together inside project rooms to turn ideas into completed outcomes.

This repository contains the MVP scaffold (Phase 1) built from the project's source-of-truth documents: [`PROJECT_VISION.md`](./PROJECT_VISION.md), [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md), and [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tech stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS** (dark theme)
- **Prisma ORM** with **SQLite** for development (PostgreSQL-compatible schema)

## What's included (Phase 1)

- Three-pane workspace UI (dark theme):
  - **Left sidebar** — workspace name, room list, create-room button, team members
  - **Center** — chat messages, message input, inline `@mention` highlighting
  - **Right panel** — AI agents, project context, shared memory, decisions
- Database-driven agent model (default team: **ARi** → OpenAI, **Cloudy** → Anthropic)
- Prisma schema for all core entities
- Mention parser (`lib/chat/mention-parser.ts`)
- Mock data so the UI runs with **no AI keys and no database** required

> ⚠️ The MVP UI uses **mock data** and **mocked agent replies**. No real AI calls are made — the AI Router (`lib/ai/ai-router.ts`) is a later build phase. The frontend never calls AI providers directly.

## Project structure

```
app/                 Next.js App Router (layout, page, globals)
components/
  layout/            Sidebar
  chat/              ChatPanel, MessageItem, MessageInput
  workspace/         WorkspaceView, RightPanel
  agents/            AgentList
lib/
  db.ts              Prisma client singleton
  utils.ts           UI helpers
  mock-data.ts       Mock workspace/agents/messages
  chat/              mention-parser.ts
prisma/
  schema.prisma      All core entities
  seed.ts            Seeds Van + ARi + Cloudy
types/
  index.ts           Shared domain types
```

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env

# 3. Create the SQLite database and generate the Prisma client
npm run db:push
npm run db:generate

# 4. (Optional) Seed the default team and workspace
npm run db:seed

# 5. Start the dev server
npm run dev
```

Then open <http://localhost:3000>.

> The UI runs on mock data, so step 5 works even before the database steps.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run db:push` | Apply the Prisma schema to SQLite |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:seed` | Seed Van + ARi + Cloudy |
| `npm run db:studio` | Open Prisma Studio |

## Roadmap

Phase 1 (this scaffold) → Workspace system → Room system → Human chat → Agent system → AI provider abstraction → AI Router → Mention system → Project Context & Memory → Decision Summary → Invitations → Polish. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full build order.
