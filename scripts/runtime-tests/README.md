# Runtime tests

End-to-end runtime tests for HiveMind, one file per phase. Each script exercises
that phase's API routes and behavior against a **running dev server**, seeding
its own data via Prisma where the single fixed dev user can't reach a scenario
alone.

These are plain Node scripts (`.mjs`), not a unit-test framework. They were the
verification harness used throughout the phased MVP build and are kept here as a
regression suite.

## How to run

Prerequisites (see the repository [`README.md`](../../README.md) for full setup):

```bash
cp .env.example .env            # AI keys optional; blank → local stub provider
npm install
export DATABASE_URL="file:./dev.db"
npx prisma generate
npx prisma db push              # create the SQLite dev database
npm run dev                     # http://localhost:3000  (must be running)
```

Then, in a second shell, run a phase test:

```bash
DATABASE_URL="file:./dev.db" node scripts/runtime-tests/phase7-runtime-test.mjs
```

Each script prints `✓ / ✗` per check and a final pass/fail count.

## Two non-obvious requirements

1. **Dev server only — not `npm run start`.** With no provider API keys, the AI
   provider factory (`lib/ai/providers/index.ts`) returns a local **stub** only
   outside production. Under `npm run start` (`NODE_ENV=production`) with no
   keys, the AI Router degrades gracefully ("could not respond") instead of
   stubbing, so AI-dependent assertions won't hold. Run against `npm run dev`.

2. **Fresh database per phase.** Each test seeds its own data; running several
   back-to-back against a shared DB causes cross-test contamination. Reset the
   DB between phases (e.g. delete `prisma/dev.db*` and re-run `prisma db push`).

## Phases

| Script | Phase |
| --- | --- |
| `phase3-runtime-test.mjs`  | Human team system |
| `phase4-runtime-test.mjs`  | AI agent foundation |
| `phase5-runtime-test.mjs`  | Room management |
| `phase6-runtime-test.mjs`  | Human chat system |
| `phase7-runtime-test.mjs`  | Mentions parser + AI routing |
| `phase8-runtime-test.mjs`  | Project context + shared memory |
| `phase9-runtime-test.mjs`  | Decision summary system |
| `phase10-runtime-test.mjs` | Realtime room updates |
| `phase11-runtime-test.mjs` | Knowledge base + RAG |
| `phase12-runtime-test.mjs` | Multi-agent discussion |

Last known-good counts are recorded in [`docs/INTEGRATION.md`](../../docs/INTEGRATION.md).
