# Feature Tracker

Single source of truth for implementation status. Update this file whenever work starts or completes (see `AGENT.md` protocol).

Statuses: `Not started` · `In progress` · `Blocked` · `In review` · `Done` · `Deferred`

Last updated: 2 Aug 2026

## Phase 0 — Foundation

| # | Feature | Status | Notes |
|---|---|---|---|
| F0.1 | Project documentation set (README, AGENT, PRODUCT, ARCHITECTURE, DATA_SOURCES, ROADMAP, FEATURES, DECISIONS) | Done | 2 Aug 2026 |
| F0.2 | CLI access verified (Convex via npx 1.43.0, Vercel via npx 58.4.4) | Done | Not installed globally; pin as devDeps at scaffold |
| F0.3 | Resolve open decisions D1–D7 | In progress | See DECISIONS.md |
| F0.4 | Scaffold Next.js (App Router, TS strict) + Convex + Clerk | Not started | Blocked by F0.3 |
| F0.5 | ESLint flat config incl. @convex-dev/eslint-plugin + pre-commit hooks | Not started | |
| F0.6 | Design tokens (navy/teal/off-white/coral), Inter or Geist, badge system | Not started | Per PRODUCT.md design direction |
| F0.7 | Git repo init + first commit + Vercel project link | Not started | |

## MVP — Data & ingestion

| # | Feature | Status | Notes |
|---|---|---|---|
| F1.1 | Convex schema v1 (exercises, projects, versions, facts, sources, reference entities) | Not started | Sketch in ARCHITECTURE.md |
| F1.2 | Snapshot storage with content hashing (Vercel Blob) | Not started | |
| F1.3 | HDB launch/project page adapter (fetch + deterministic parser) | Not started | Hourly in launch week |
| F1.4 | HDB announcements adapter (upcoming exercises) | Not started | official vs inferred labeling |
| F1.5 | data.gov.sg adapters (construction polygons, resale txns, school directory) | Not started | Needs prod API key |
| F1.6 | OneMap client (token cache + 72h auto-refresh, search/routing/themes) | Not started | |
| F1.7 | LLM fallback extraction for changed/unparsed sections | Not started | `extractedBy: llm` marking |
| F1.8 | Reconciliation job + human review queue | Not started | |
| F1.9 | Atomic publish → cache invalidation → alert trigger | Not started | |
| F1.10 | Parser monitoring + Sentry job logs | Not started | |
| F1.11 | Seed: 10 representative projects with full provenance | Not started | Sprint W1–2 acceptance |

## MVP — Explorer & project pages

| # | Feature | Status | Notes |
|---|---|---|---|
| F2.1 | Explorer: list + map + timeline, filter by town/region/MRT/price/flat type/wait/classification/status | Not started | Signature surface |
| F2.2 | MapLibre map with project polygons, custom light basemap | Not started | Basemap decision D3 |
| F2.3 | Permanent project page (full blueprint: facts, location, affordability, comparables, site analysis, lifecycle, source log) | Not started | SSR, canonical slugs |
| F2.4 | Launch exercise pages (/bto/[exercise]) | Not started | |
| F2.5 | Town pages with price history (/bto/town/[town]) | Not started | |
| F2.6 | MRT catchment pages (/bto/near-[mrt]-mrt) | Not started | |
| F2.7 | Upcoming page separating official vs inferred | Not started | |
| F2.8 | Search + filter state (URL-shareable) | Not started | |
| F2.9 | Mobile bottom-sheet-over-map UX | Not started | |
| F2.10 | "Last verified" + provenance badges on all fact surfaces | Not started | |

## MVP — Accounts, watchlists, alerts

| # | Feature | Status | Notes |
|---|---|---|---|
| F3.1 | Clerk auth (Google), browse-without-login gating | Not started | |
| F3.2 | Watchlists: project, town, MRT catchment targets | Not started | Drawn polygons → V2 |
| F3.3 | Change detection → alert matching engine | Not started | |
| F3.4 | Email alerts + digest (Resend/Postmark per D5) | Not started | |
| F3.5 | Comparison workspace (2–4 projects, trade-offs) + persistent tray | Not started | |

## MVP — Planner & SEO

| # | Feature | Status | Notes |
|---|---|---|---|
| F4.1 | Planner: constraint extraction into typed profile (show/edit) | Not started | |
| F4.2 | Transparent weighted ranking + user-adjustable weights | Not started | |
| F4.3 | Cited AI answers (no uncited project facts; refuse when stale/missing) | Not started | |
| F4.4 | AI docked panel (desktop) / full-screen sheet (mobile) | Not started | |
| F4.5 | SEO hardening: sitemaps per family, breadcrumbs, structured data, canonical/redirects | Not started | |
| F4.6 | Analytics: Vercel Web Analytics + activation/retention events | Not started | |
| F4.7 | Historical backfill → 50–100 permanent pages + editorial QA | Not started | Launch gate |

## V1 (post-launch, planned)

| # | Feature | Status | Notes |
|---|---|---|---|
| V1.1 | Profile-based ranking from saved household profile | Not started | |
| V1.2 | Commute calculator (OneMap routing, workplace pairs) | Not started | |
| V1.3 | Affordability scenarios (cash/CPF, mortgage range, grants links) | Not started | |
| V1.4 | SBF tracker | Not started | |
| V1.5 | Public project change log | Not started | |

## V2 (planned)

| # | Feature | Status | Notes |
|---|---|---|---|
| V2.1 | Draw-an-area search & area watchlists (polygons) | Not started | |
| V2.2 | "Wait or apply?" scenario comparison | Not started | |
| V2.3 | Construction progress updates | Not started | |
| V2.4 | Richer site-plan analysis (orientation, noise — labelled analysis) | Not started | Requires stronger data confidence |

## Progress log

| Date | Entry |
|---|---|
| 2 Aug 2026 | Tracker created. F0.1, F0.2 done. Next: resolve open decisions, then scaffold (F0.4). |
