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
  - **Editable agents** — rename any agent (including ARi/Cloudy), switch provider, and pick from a **model catalog** (e.g. Claude Opus 4.8 / Sonnet 4.6 / Haiku 4.5, GPT-4o / 4.1 / 4o-mini / o3, Gemini 2.5 Pro / 2.0 Flash)
- **AI Router** (`lib/ai/ai-router.ts`) — the only place AI orchestration happens
  - **Cheapest-model selector** — when no agent is `@mentioned`, the cheapest active model decides who should answer (instead of every agent burning tokens at once)
- **Provider abstraction** — OpenAI / Anthropic / Gemini adapters behind one interface (all three now call real APIs, with mock fallback when keys are absent)
- **Web search for every agent** (`lib/ai/tools/web-search.ts`) — live results via Tavily (`SEARCH_API_KEY`), with mock fallback; injected into context when a message needs fresh info
- **Document reading** — upload **PDF / Word (.docx) / Excel (.xlsx) / CSV / text**; parsed text is fed to the agents (`lib/files/parse.ts`)
- **Token budget** — a shared **per-workspace token pool** with per-model sub-limits, per-call tokenization, app-wide totals/averages, and **auto-fallback** to another model when one runs out
- **Mention system** — `@ARi`, `@Cloudy`, multi-agent, default-agent fallback
- **Context builder** with the spec's priority order (ProjectContext before Memory) + attachments + web results
- **Decision summaries** with selectable ranges — last 30 messages / past 2 hours / past day / whole project
- **Real auth** — email + password with server-side sessions (scrypt-hashed, httpOnly cookie); every API route is gated and each user gets their own workspace
- Role-based permissions (owner / admin / member / viewer)
- **Per-room passcodes** — only the room creator can set/clear a passcode; locked rooms are gated client- and server-side
- **Human collaboration** — workspace members, invitations (invite by email), room-agent membership
- **Search** rooms and people within a workspace from the sidebar
- Full REST API with per-resource CRUD (see below)
- Interactive right panel — agents editor, project context / memory inline (admins/owners), and a live **token usage** tab
- Auto-seeding bootstrap so the app works on a fresh database with **no AI keys**

## API

| Resource | Routes |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` |
| Workspaces | `GET/POST /api/workspaces`, `GET/PATCH/DELETE /api/workspaces/[id]` |
| Rooms | `GET/POST /api/rooms`, `GET/PATCH/DELETE /api/rooms/[id]` |
| Messages | `GET/POST /api/messages` (POST runs the AI Router) |
| Agents | `GET/POST /api/agents`, `PATCH/DELETE /api/agents/[id]` |
| Room agents | `GET/POST /api/room-agents`, `DELETE /api/room-agents/[id]` |
| Memory | `GET/POST /api/memory`, `PATCH/DELETE /api/memory/[id]` |
| Project context | `GET/POST /api/project-context`, `PATCH/DELETE /api/project-context/[id]` |
| Decisions | `GET /api/decisions`, `POST /api/summaries/decision` (accepts `range`) |
| Invitations | `GET/POST /api/invitations` |
| Files | `GET /api/files?roomId=`, `POST /api/files` (upload + parse) |
| Tokens | `GET /api/tokens?workspaceId=` (workspace pool + app stats) |
| Room passcode | `POST /api/rooms/[roomId]/verify`; set via `PATCH /api/rooms/[roomId]` |
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
  workspace/           WorkspaceView, RightPanel, TokenPanel
  agents/              AgentEditor
  auth/                AuthScreen (sign in / sign up)
lib/
  db.ts                Prisma client singleton
  auth.ts              getCurrentUser() from the session cookie
  auth/session.ts      Session create / resolve / destroy
  crypto.ts            Shared scrypt hashing (passwords + passcodes)
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
  seed.ts              Seeds a demo account + ARi + Cloudy
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
| `npm run lint` | Run ESLint |
| `npm run test` | Run the unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:push` | Apply the Prisma schema to SQLite |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:seed` | Seed a demo account + ARi + Cloudy |
| `npm run db:studio` | Open Prisma Studio |

## Roadmap

Phase 1 (this scaffold) → Workspace system → Room system → Human chat → Agent system → AI provider abstraction → AI Router → Mention system → Project Context & Memory → Decision Summary → Invitations → Polish. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full build order.
