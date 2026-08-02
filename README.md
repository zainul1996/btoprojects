# BTOProjects.sg

**Plan your HDB home with confidence.**

The definitive decision platform for Singapore's new-home journey — a living database and planning assistant that helps a buyer answer: *"Which BTO project fits my life, and what should I do next?"*

> Status: **Pre-development (docs & planning phase)**. No application code exists yet.

## What this is

An AI-guided discovery and comparison experience for HDB BTO launches, grounded in official data, with permanent project pages that stay useful from announcement through launch, construction, SBF and MOP.

- **MVP focus:** Discovery + alerts
- **Core moat:** Structured lifecycle data (not the language model)
- **Positioning:** The buyer's planning layer *above* official data — not another BTO news site

The three signature features:

1. **Personalised launch shortlist** — transparent ranking from budget, commute, family proximity and wait tolerance
2. **Follow any place** — project, town, MRT catchment or drawn boundary, with alerts on official changes
3. **Lifecycle project record** — one canonical page per project from announcement → BTO → construction → SBF → MOP

## Stack (planned)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) on Vercel |
| Backend / DB | Convex (projects, profiles, watchlists, sources, jobs, realtime) |
| Auth | Clerk (Google sign-in; browsing requires no login) |
| Maps | MapLibre GL JS + OneMap APIs (geocoding, routing, themes) |
| Email | Resend or Postmark (transactional alerts) — see `docs/DECISIONS.md` |
| Scheduler | Vercel Cron + Convex scheduled functions |
| Raw snapshots | Vercel Blob (Cloudflare R2 later) |
| AI | Provider abstraction; DeepSeek as initial option — swappable |
| Analytics | Vercel Web Analytics first |
| Monitoring | Sentry + structured job logs |

## Documentation map

| Doc | Purpose |
|---|---|
| `AGENT.md` | Operating manual for AI coding agents — read first |
| `docs/PRODUCT.md` | Product strategy summary: positioning, users, guardrails |
| `docs/ARCHITECTURE.md` | System design, schema sketch, ingestion & AI pipelines |
| `docs/DATA_SOURCES.md` | Data acquisition plan, API details, provenance rules |
| `docs/ROADMAP.md` | Phases, sprints, acceptance tests, current status |
| `docs/FEATURES.md` | Feature-by-feature implementation tracker |
| `docs/DECISIONS.md` | Decision log (ADR-lite) and open questions |
| `docs/strategy/` | Original market research & product strategy PDF |

## Environment / CLI access (verified 2 Aug 2026)

- Node `v26.3.0`, npm `11.16.0` (via Homebrew)
- **Convex CLI**: not installed globally; works via `npx convex` (v1.43.0)
- **Vercel CLI**: not installed globally; works via `npx vercel` (v58.4.4). Note: Vercel CLI declares engine support up to Node 24 — it runs on Node 26 with an `EBADENGINE` warning; consider Node 24 LTS if issues appear.
- Both will be pinned as devDependencies once the app is scaffolded.

## Quickstart (once scaffolded)

```bash
npm install
npx convex dev   # development backend — NEVER `npx convex deploy` during dev
npm run dev      # Next.js dev server
```
