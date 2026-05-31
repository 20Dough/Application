# Post-MVP Cleanup Tasks — AI Team Up (HiveMind) v1.0

Findings from the Post-MVP Cleanup Phase (2026-05-31), after Phases 1–12 merged.
This phase **stabilizes** the project; it intentionally does **not** add product
features, change AI behavior, perform large refactors, or start deployment.
Each item below is a follow-up task with the evidence behind it.

Severity: 🔴 high · 🟡 medium · 🟢 low / housekeeping

## Branches & repository hygiene

- 🟡 **Promote a real default branch.** The integration head is
  `claude/phase-7-pr-1qlYo` — a misleading name for the cumulative Phase 1–12
  line. Create/rename a `main` (or `release/v1.0`) branch from it and set it as
  the repo default so the source of truth is obvious. (See `INTEGRATION.md`.)
- 🟡 **Delete stale docs-only branches.** `claude/hivemind-mvp-phase-1-IKBkz`
  and `claude/project-summary-docs-jxyba` contain only documentation that is
  byte-identical to copies already on the integration head — no app code. They
  caused the "cleanup branch has no application" confusion at the start of this
  phase. Safe to delete once this PR merges.
- 🟢 **Archive merged phase branches.** Phases 2–12 each have a feature branch
  that is fully merged into the integration head. Tag `v1.0` on the head, then
  delete or archive the per-phase branches to declutter the branch list.
- 🟢 **Resolve duplicate Phase-1 branches.** Two exist:
  `...phase-1-KReeq` (the real foundation, in the lineage) and
  `...phase-1-IKBkz` (docs-only, stale). Keep history via a tag; drop the
  docs-only one.
- 🟢 **Close/relabel stale open PRs.** PRs #1, #2, #3 (Phases 4, 5, 6) are still
  "open" although their commits are merged into the integration line. Close them
  with a note pointing at the integration head to avoid confusion.

## Tests & stability

- 🔴 **Flaky Phase 7 runtime test / messages route.** `phase7-runtime-test.mjs`
  usually reports 30/30 but intermittently (~1 in 3 runs observed) fails 1–4
  checks in the "provider failure → graceful system message" scenario, with the
  server logging `SyntaxError: Unexpected end of JSON input` and returning **500**
  from `POST /api/rooms/[roomId]/messages`. The human message + working agent
  reply path should never 500. Reproduce by running the test repeatedly against
  a `npm run dev` server. Investigate the request/parse path on the messages
  route under the mixed working-agent + placeholder-agent (`gemini`) case and the
  test's request sequencing/concurrency. Track down the unguarded JSON parse and
  ensure the route always degrades to 201 + a "could not respond" notice.
- 🟡 **No test runner / npm script for the suite.** Runtime tests are loose
  `scripts/phaseN-runtime-test.mjs` files run by hand, each needing a running dev
  server and a fresh DB. Add an `npm run test:e2e` (or similar) that boots a dev
  server, resets the DB **per phase**, runs all phase tests, and reports a
  combined pass/fail. This removes the manual, error-prone setup and the
  shared-DB cross-contamination trap.
- 🟡 **Document the test methodology in-repo.** The non-obvious requirements
  (dev server only — not `npm run start`; fresh DB per phase) cost real time to
  rediscover. Captured now in `INTEGRATION.md`; fold into the eventual README.

## Documentation

- 🟢 **Add a README.** There is no `README.md`; onboarding currently means
  reading `ARCHITECTURE.md` + `PRODUCT_REQUIREMENTS.md` + `PROJECT_VISION.md` +
  `PROJECT_SUMMARY.md`. Add a short README with the run/verify steps from
  `INTEGRATION.md` and links to the design docs.
- 🟢 **Note the production stub gotcha near the code.** The non-production gating
  of the stub provider (`lib/ai/providers/index.ts`) is correct but surprising
  in testing. The factory comment already explains it; cross-reference it from
  the test docs so future runs don't use `npm run start` by mistake.

## Known limitations carried from the MVP (not bugs — future product work)

These are documented in the phase PRs and are **out of scope** for cleanup;
listed here so they are tracked in one place:

- Single fixed dev user — no real authentication yet.
- Synchronous AI/knowledge/discussion work — no background queue.
- Polling-based "realtime" (no server push / websockets).
- In-process cosine similarity over JSON-stored embeddings — no vector index.
- Knowledge ingestion is text/markdown only (no PDF/DOCX parsing).
- No pagination on message/decision/knowledge lists.

## Out of scope for this phase (per the cleanup brief)

- No new product features.
- No changes to AI behavior. _(The Phase 7 flake above is filed as a task to
  investigate, not fixed here, since the fix touches the AI routing path.)_
- No large architecture refactors.
- No production deployment.
