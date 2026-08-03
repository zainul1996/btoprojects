# Roadmap

Granular feature status lives in `FEATURES.md`. This file tracks phases, milestones and where we are right now.

**Current status: MVP product and SEO hardening are complete. A Vercel production deployment exists but requires access, and btoprojects.sg does not resolve in DNS. Public launch remains blocked by hosting access and DNS.**
Last updated: 3 Aug 2026

## Phase 0 — Setup (this week)

| Milestone | Status | Notes |
|---|---|---|
| Strategy review & project docs | Done | This doc set, 2 Aug 2026 |
| Verify CLI access (Convex, Vercel) | Done | via `npx`; see README |
| Resolve open decisions (`DECISIONS.md`) | Done | npm, single app, shadcn, OpenRouter, GitHub |
| Scaffold Next.js + Convex + Clerk repo | Done | commit 8d071b7 |
| Design system foundation (tokens, fonts) | Done | commit 5e19dd7 |

## MVP — Weeks 1–10 (target: public launch)

| Sprint | Outcome | Acceptance test | Status |
|---|---|---|---|
| W1–2 | Schema, source adapters, design system, 10 representative projects | Every field has provenance; mobile project page works | **Done** (2 Aug) — 12 projects, 228 facts, 17 tables, AA-verified design system |
| W3–4 | Explorer, map, launch/town/project routes, search & filters | User finds a suitable project in < 2 minutes | **Done** (2 Aug) — explorer w/ map+URL filters, all route families SSR |
| W5–6 | Comparison, auth, watchlists, ~~email~~ alerts | User saves area/project and receives a test change alert | **Done** (2 Aug) — compare workspace, Clerk, watchlists; **Telegram substituted for email per user**; test-alert loop verified live |
| W7–8 | Grounded planner, ranking rules, analytics, SEO hardening | Answers cite records; no uncited project facts | **Mostly done** (3 Aug): planner and SEO hardening complete; analytics remains pending |
| W9–10 | Historical backfill, editorial QA, public launch | 50–100 high-quality permanent pages; parser monitoring live | Not started — backfill + Sentry + deploy are pre-launch, user drives timing |

Explicitly deferred from MVP: ballot-odds predictions, best-unit picks, automated resale valuation promises, social features, auth wall.

## V1 — Decision tooling (post-launch)

Profile-based ranking · commute calculator · affordability scenarios · SBF tracker · project change log.
Guidance: keep recommendations explainable.

## V2 — Retention & differentiation

Draw-an-area search · "wait or apply?" scenarios · construction updates · richer site-plan analysis.
Guidance: requires stronger data confidence first.

## Later — Monetisation surfaces

Renovation/referral marketplace · agent handoff · premium reports · mobile app.
Guidance: avoid degrading trust or neutrality. See PRODUCT.md monetisation sequence.

## Metrics to instrument (from strategy)

- **North star:** % of active users who create a shortlist/watchlist after viewing project evidence
- **Activation:** first comparison, first saved profile, first alert subscription
- **Quality:** source freshness, extraction error rate, correction rate, answer citation coverage
- **Retention:** return for new exercise, source update or alert digest
- **Acquisition:** non-brand organic clicks to project/town/tool pages; email conversion
- **Monetisation:** partner-intent actions per engaged user (not raw lead submissions)

## Change log

| Date | Change |
|---|---|
| 2 Aug 2026 | Roadmap created from strategy PDF; Phase 0 started |
| 2 Aug 2026 | First autonomous build complete: Phase 0 + MVP sprints W1–W8 (scope subs: Telegram for email, seed-based HDB data per D-seed). Validation + hardening in progress |
| 3 Aug 2026 | SEO hardening completed and validated. Public launch is waiting on Vercel access settings and DNS for btoprojects.sg. |
