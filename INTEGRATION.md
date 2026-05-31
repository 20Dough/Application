# Integration & Branch Map — AI Team Up (HiveMind) v1.0

This document is the authoritative reference for **which branch is the real
integrated application** after Phases 1–12, how the phase branches relate to one
another, and how to run and verify the app. It exists to remove the "which
branch is the source of truth?" confusion that built up during the phased MVP.

_Last verified: 2026-05-31, from the latest merged head (Phase 12, plus the
Phase 7 flaky-500 fix merged via PR #11)._

## TL;DR

- **Integration head (source of truth): `claude/phase-7-pr-1qlYo`.**
  Despite its name, this branch is **not** "just Phase 7" — it is the running
  integration line. Phases 8, 9, 10, 11, and 12 were each branched from it and
  merged **back into it**, so it holds the full Phase 1→12 application.
- The branch name is a historical artifact. Treat `claude/phase-7-pr-1qlYo` as
  **`main`** until a real default branch is established (see Cleanup Tasks).
- This `claude/post-mvp-cleanup-*` branch was re-based onto that integration
  head so it contains the actual application (previously it carried only docs).

## Phase lineage (linear history on the integration branch)

```
360ba65  Phase 1  project foundation        (claude/hivemind-mvp-phase-1-KReeq)
7a11b86  Phase 2  workspace system
9e45abf  Phase 3  human team system
37e99c1  Phase 4  AI agent foundation
6cedff9  Phase 5  room management
1aee1d1  Phase 6  human chat system
428313c  Phase 7  mentions parser + AI routing
e0324c9  Phase 8  project context + shared memory
5893c99  Phase 8  fix: MemoryItem.importance default → 1
5f643bc  Phase 9  decision summary system
290ebe2  Phase 10 realtime room updates
72af054  Phase 11 knowledge base + RAG
ad084c5  Phase 12 multi-agent discussion
ead6e9f  Merge PR #9 (Phase 12)
ae79762  Fix Phase 7 flaky 500 on POST /rooms/[roomId]/messages
aaf6e1d  Merge PR #11 (Phase 7 flaky-500 fix)  ← current integration head
```

All merged phase PRs (#4–#9) used `claude/phase-7-pr-1qlYo` as their base, which
is why each PR diff was exactly its own phase and why this branch is the
cumulative head.

## Branch inventory

| Branch | Role | Keep? |
| --- | --- | --- |
| `claude/phase-7-pr-1qlYo` | **Integration head (Phases 1–12). Source of truth.** | ✅ promote to `main` |
| `claude/hivemind-mvp-phase-1-KReeq` | Real Phase 1 foundation (root of the lineage) | merged into integration line |
| `claude/phase-2-workspace-system-2QK1C` … `claude/multi-agent-discussion-phase-12-0f4qr` | Per-phase feature branches, all merged | archive/delete after v1.0 |
| `claude/phase-6-review-approved-09CCU` | Snapshot of the Phase 7 base | archive/delete |
| `claude/post-mvp-cleanup-*` | This cleanup branch | active |
| **`claude/hivemind-mvp-phase-1-IKBkz`** | **Stale docs-only branch** — only `ARCHITECTURE.md`, `PRODUCT_REQUIREMENTS.md`, `PROJECT_VISION.md`, byte-identical to the copies already on the integration head. **No app code.** | ⚠️ stale — safe to delete |
| **`claude/project-summary-docs-jxyba`** | **Stale docs-only branch** — only `PROJECT_SUMMARY.md` + `PROJECT_VISION.md`, already on the integration head. | ⚠️ stale — safe to delete |

> **Docs-only confusion:** the two flagged branches contain documentation that
> already lives verbatim on the integration head. They carry no application
> code, so basing work on them yields an empty app. They are retained only for
> history and should be deleted once this cleanup is merged.

## How to run the app (from the integration head)

```bash
cp .env.example .env                 # AI keys optional; blank → local stub provider
npm install
export DATABASE_URL="file:./dev.db"
npx prisma generate
npx prisma db push                   # creates the SQLite dev database
npm run dev                          # http://localhost:3000  (development)
# or, production build:
npm run build && npm run start
```

- **No AI keys required for development.** With `OPENAI_API_KEY` /
  `ANTHROPIC_API_KEY` blank, the provider factory returns a local **stub**
  provider so the collaboration loop works offline.
- **Important gotcha:** the stub is gated to non-production
  (`lib/ai/providers/index.ts`). Under `npm run start` (`NODE_ENV=production`)
  with no keys, the AI Router **degrades gracefully** ("could not respond")
  instead of stubbing. **Runtime tests therefore require `npm run dev`, not
  `npm run start`.**

## Verification status (this cleanup, 2026-05-31)

Run from the integration head:

- `npm run typecheck` — ✅ clean
- `npm run build` — ✅ succeeds; all Phase 1–12 routes registered
- Runtime regression (each phase on a fresh DB against a `npm run dev` server):

  | Phase | Result |
  | --- | --- |
  | 3 | 28 / 28 ✅ |
  | 4 | 32 / 32 ✅ |
  | 5 | 42 / 42 ✅ |
  | 6 | 32 / 32 ✅ |
  | 7 | 30 / 30 ✅ **(flake fixed in PR #11 — now 35/35 stable)** |
  | 8 | 54 / 54 ✅ |
  | 9 | 33 / 33 ✅ |
  | 10 | 27 / 27 ✅ |
  | 11 | 52 / 52 ✅ |
  | 12 | 63 / 63 ✅ |

  Each phase test seeds its own data and must run against a **fresh database**;
  running them back-to-back on a shared DB causes cross-test contamination.

See `CLEANUP_TASKS.md` for the issues found during this verification.
