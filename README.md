# HiveMind

> Human + AI Team Collaboration Workspace — a shared space where teams of humans and teams of AI work together inside project rooms to turn ideas into completed outcomes.

This repository implements the working MVP — the full core collaboration loop (human message → mention → AI Router → AI responds → saved & shared) — built from the project's source-of-truth documents: [`PROJECT_VISION.md`](./PROJECT_VISION.md), [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md), and [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tech stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS** (dark theme)
- **Prisma ORM** with **SQLite** for development (PostgreSQL-compatible schema)

## What's included

- Three-pane workspace UI (dark theme):
  - **Left sidebar** — workspace name, room list, create-room button, team members
  - **Center** — chat messages, message input, inline `@mention` highlighting, "Summarize" action
  - **Right panel** — AI agents, project context, shared memory, decisions
- **Database-driven agents** (default team: **ARi** → OpenAI, **Cloudy** → Anthropic)
- **Accounts & login** — username + password sign-up/sign-in, database-backed
  sessions (httpOnly cookie), scrypt password hashing; each user is shown by name
- **Realtime chat** — new human and AI messages stream live over Server-Sent
  Events, no reloading
- **AI Router** (`lib/ai/ai-router.ts`) — the only place AI orchestration happens
- **Provider abstraction** — OpenAI / Anthropic / Gemini adapters behind one interface
- **3 default agents** — ARi (OpenAI), Cloudy (Anthropic), Sage (Gemini)
- **Mention system** — `@ARi`, `@Cloudy`, `@Sage`, multi-agent, default-agent fallback
- **Context builder** with the spec's priority order (ProjectContext before Memory)
- **Decision summaries** generated from recent messages
- Role-based permissions (owner / admin / member / viewer)
- **Human collaboration** — workspace members, invitations (invite by email), room-agent membership
- **Team & agent management UI** — invite/remove members and change roles; create,
  edit, activate/deactivate, delete agents and add/remove them from a room
- Full REST API with per-resource CRUD (see below)
- Interactive right panel — add project context / memory inline (admins/owners)
- Auto-seeding bootstrap so each new account gets a ready-to-use workspace

## API

| Resource | Routes |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Workspaces | `GET/POST /api/workspaces`, `GET/PATCH/DELETE /api/workspaces/[id]` |
| Rooms | `GET/POST /api/rooms`, `GET/PATCH/DELETE /api/rooms/[id]` |
| Messages | `GET/POST /api/messages` (POST runs the AI Router) |
| Realtime | `GET /api/rooms/[roomId]/stream` (Server-Sent Events) |
| Agents | `GET/POST /api/agents`, `PATCH/DELETE /api/agents/[id]` |
| Room agents | `GET/POST /api/room-agents`, `DELETE /api/room-agents/[id]` |
| Memory | `GET/POST /api/memory`, `PATCH/DELETE /api/memory/[id]` |
| Project context | `GET/POST /api/project-context`, `PATCH/DELETE /api/project-context/[id]` |
| Decisions | `GET /api/decisions`, `POST /api/summaries/decision` |
| Members | `PATCH/DELETE /api/members/[id]` (change role / remove) |
| Invitations | `GET/POST /api/invitations`, `PATCH/DELETE /api/invitations/[id]` |
| Bootstrap | `GET /api/bootstrap` (one-call hydration + auto-seed) |

> The frontend **never** calls AI providers directly — all AI runs server-side through the AI Router. When `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are absent, providers return clearly-labeled mock replies so the full loop runs locally with zero external services.

## Project structure

```
app/
  layout.tsx, page.tsx, globals.css
  api/                 REST routes
    bootstrap/         One-call workspace hydration (auto-seeds)
    workspaces/  rooms/  messages/  agents/
    memory/  project-context/  decisions/  summaries/decision/
components/
  layout/              Sidebar
  chat/                ChatPanel, MessageItem, MessageInput
  workspace/           WorkspaceView, RightPanel
  agents/              AgentList
lib/
  db.ts                Prisma client singleton
  auth.ts              Placeholder current user (Clerk-ready)
  permissions.ts       Role checks
  api.ts               API response + membership helpers
  serialize.ts         Prisma rows → domain types
  client-api.ts        Browser fetch helpers
  bootstrap.ts         Default workspace seeding
  utils.ts             UI helpers
  ai/
    ai-router.ts       AI orchestration (the only place)
    types.ts           AIProvider interface
    provider-factory.ts
    providers/         openai, anthropic, gemini
    mock.ts            No-key fallback
  chat/mention-parser.ts
  memory/context-builder.ts
  summary/decision-summary.ts
prisma/
  schema.prisma        All core entities
  seed.ts              Seeds a demo account + ARi, Cloudy, Sage
types/
  index.ts             Shared domain types
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

# 4. (Optional) Seed a demo account you can log in with
#    username: founder   password: password123
npm run db:seed

# 5. Start the dev server
npm run dev
```

Then open <http://localhost:3000>, create an account (or use the seeded demo
login), and you'll land in your own auto-seeded workspace with ARi, Cloudy, and
Sage ready to mention.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:push` | Apply the Prisma schema to SQLite |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:seed` | Seed a demo account (founder / password123) + ARi, Cloudy, Sage |
| `npm run db:studio` | Open Prisma Studio |

## Roadmap

Phase 1 (this scaffold) → Workspace system → Room system → Human chat → Agent system → AI provider abstraction → AI Router → Mention system → Project Context & Memory → Decision Summary → Invitations → Polish. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full build order.
