# Roadmap

Granular feature status lives in `FEATURES.md`. This file tracks phases, milestones and where we are right now.

**Current status: Phase 0 — Project setup (docs complete, scaffold not started)**
Last updated: 2 Aug 2026

## Phase 0 — Setup (this week)

| Milestone | Status | Notes |
|---|---|---|
| Strategy review & project docs | Done | This doc set, 2 Aug 2026 |
| Verify CLI access (Convex, Vercel) | Done | via `npx`; see README |
| Resolve open decisions (`DECISIONS.md`) | In progress | Package manager, email provider, basemap, LLM |
| Scaffold Next.js + Convex + Clerk repo | Not started | Blocked on D1–D3 decisions |
| Design system foundation (tokens, fonts) | Not started | Per PRODUCT.md design direction |

## MVP — Weeks 1–10 (target: public launch)

| Sprint | Outcome | Acceptance test | Status |
|---|---|---|---|
| W1–2 | Schema, source adapters, design system, 10 representative projects | Every field has provenance; mobile project page works | Not started |
| W3–4 | Explorer, map, launch/town/project routes, search & filters | User finds a suitable project in < 2 minutes | Not started |
| W5–6 | Comparison, auth, watchlists, email alerts | User saves area/project and receives a test change alert | Not started |
| W7–8 | Grounded planner, ranking rules, analytics, SEO hardening | Answers cite records; no uncited project facts | Not started |
| W9–10 | Historical backfill, editorial QA, public launch | 50–100 high-quality permanent pages; parser monitoring live | Not started |

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
