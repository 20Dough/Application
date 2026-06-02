# Deploying HiveMind

HiveMind runs as a **long-running Node server** (not serverless), because the
realtime chat uses Server-Sent Events that need a persistent process. Use a host
that keeps the process alive: **Railway**, **Render**, or **Fly.io**. It needs a
**PostgreSQL** database.

The production start command runs migrations first, then boots the server:

```
prisma migrate deploy && next start   # = npm run start:prod
```

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Most hosts inject this. |
| `NODE_ENV` | ✅ | `production` |
| `OPENAI_API_KEY` | optional | ARi. Omit to use mock replies. |
| `ANTHROPIC_API_KEY` | optional | Cloudy. |
| `GEMINI_API_KEY` | optional | Sage. |

> With no AI keys the app still works — agents return clearly-labeled mock
> replies. Add keys anytime; no redeploy of code needed.

---

## Option A — Render (blueprint, easiest)

A [`render.yaml`](./render.yaml) blueprint is included; it provisions the web
service **and** a managed Postgres.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. Render reads `render.yaml`,
   creates the database, and wires `DATABASE_URL` automatically.
3. (Optional) Add `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` in
   the service's **Environment**.
4. Deploy. The start command migrates the DB and launches the server.

## Option B — Railway

A [`railway.json`](./railway.json) is included.

1. Push to GitHub, then **New Project → Deploy from GitHub repo**.
2. Add a Postgres plugin: **New → Database → PostgreSQL**. Railway sets
   `DATABASE_URL` for the service automatically.
3. Add any AI keys under the service **Variables**.
4. Deploy. (`railway.json` already sets the build/start commands.)

## Option C — Fly.io / any container host

A [`Dockerfile`](./Dockerfile) builds a minimal standalone image and runs
`prisma migrate deploy` on startup.

```bash
fly launch            # detects the Dockerfile; creates the app
fly postgres create   # then: fly postgres attach <db>   (sets DATABASE_URL)
fly secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=... GEMINI_API_KEY=...
fly deploy
```

---

## Local development with Postgres

```bash
# 1. Start Postgres (Docker is easiest)
docker run --name hivemind-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hivemind -p 5432:5432 -d postgres:16

# 2. Point the app at it
cp .env.example .env       # DATABASE_URL already targets localhost:5432

# 3. Apply migrations + (optionally) seed a demo account
npm run db:migrate         # dev migrations
npm run db:seed            # login: founder / password123

# 4. Run
npm run dev
```

## Scaling note

Realtime currently uses an in-process event bus, so it is correct for a **single
instance**. To run multiple instances behind a load balancer, swap
`lib/events.ts` for Redis pub/sub (or a hosted realtime service) — the
publish/subscribe surface is small and isolated for exactly this reason.
