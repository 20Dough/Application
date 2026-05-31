# Stale PR & Branch Cleanup — Report

_Date: 2026-05-31_

## Integration head (source of truth)

`claude/phase-7-pr-1qlYo` — despite the name, this branch carries the cumulative
**Phase 1 → 12** application (137 files) plus the merged post-MVP cleanup (PR #10)
and the Phase 7 `JSON.parse` fix (PR #11). All other app branches are ancestors of
it.

## Stale PRs closed

| PR | Phase | Head branch | Head commit | Contained in integration head? |
| --- | --- | --- | --- | --- |
| #1 | Phase 4 — AI Agent Foundation | `claude/ai-agent-foundation-phase-4-lUoMW` | `37e99c1` | ✅ direct ancestor |
| #2 | Phase 5 — Room Management | `claude/room-management-phase-5-oQ9a8` | `6cedff9` | ✅ direct ancestor |
| #3 | Phase 6 — Human Chat System | `claude/human-chat-system-phase-6-oIGtu` | `5287ad6` | ✅ tree-contained* |

\* PR #3's tip `5287ad6` is a merge commit ("Merge pull request #4") that merged
Phase 7 back into the Phase 6 branch. Its tree is byte-identical to the Phase 7
commit `428313c` (an ancestor of the integration head); the only commit not already
in the integration head is the merge commit itself, which introduces **zero** tree
changes. No unique content is lost.

All three PRs were closed (not merged — their content already lives in the
integration head).

## Branch deletion status

The three stale branches were slated for deletion. **Git ref deletion is disabled
in this environment** (`git push --delete` → HTTP 403), and the GitHub MCP server
exposes no delete-branch tool. The branches therefore remain on the remote and must
be deleted from the GitHub UI / an environment with deletion rights:

- `claude/ai-agent-foundation-phase-4-lUoMW`
- `claude/room-management-phase-5-oQ9a8`
- `claude/human-chat-system-phase-6-oIGtu`

## Recommendations

- **Default branch:** promote the integration head. The current default,
  `claude/hivemind-mvp-phase-1-IKBkz`, is **docs-only** (3 files) and is not in the
  app lineage. Create `main` from `claude/phase-7-pr-1qlYo` and set it as default.
- **Release tag:** `v1.0.0` (no tags exist yet) on the integration head, marking the
  completed HiveMind MVP (Phases 1–12 + cleanup + the Phase 7 fix).
- **Next milestone:** `v1.1 — Production Hardening`: real multi-user auth (replace
  the fixed dev user), deployment pipeline, background job queue (knowledge ingestion
  & discussions run synchronously today), server-push realtime (replace polling), a
  production vector index (pgvector, replacing in-process cosine over SQLite-JSON),
  and binary document parsing (PDF/DOCX).
