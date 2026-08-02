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
| F1.1 | Convex schema v1 (exercises, projects, versions, facts, sources, reference entities) | Done | 17 tables live; projectVersions/reviewQueue deferred to HDB parser phase (D-be3) |
| F1.2 | Snapshot storage with content hashing (Vercel Blob) | Not started | |
| F1.3 | HDB launch/project page adapter (fetch + deterministic parser) | Not started | Hourly in launch week |
| F1.4 | HDB announcements adapter (upcoming exercises) | Not started | official vs inferred labeling |
| F1.5 | data.gov.sg adapters (construction polygons, resale txns, school directory) | In progress | Resale sync live (696 rows verified) + school directory sync live; polygons pending |
| F1.6 | OneMap client (token cache + 72h auto-refresh, search/routing/themes) | In progress | Token cache + lazy refresh + elastic geocode live (verified); routing/themes pending |
| F1.7 | LLM fallback extraction for changed/unparsed sections | Not started | `extractedBy: llm` marking |
| F1.8 | Reconciliation job + human review queue | Not started | |
| F1.9 | Atomic publish → cache invalidation → alert trigger | Not started | |
| F1.10 | Parser monitoring + Sentry job logs | In progress | `ingestionJobs` table records every adapter run with stats/error; Sentry wiring pending |
| F1.11 | Seed: 10 representative projects with full provenance | Done | 12 projects, idempotent upsert; 228 field-level facts with confidence + source trail |

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
| F3.1 | Clerk auth (Google), browse-without-login gating | In progress | Convex side live (auth.config + users table + authed wrappers); UI wiring pending |
| F3.2 | Watchlists: project, town, MRT catchment targets | In progress | Backend API done (add/remove/list/isWatching with dedupe); UI pending |
| F3.3 | Change detection → alert matching engine | In progress | Fan-out (project+town watchers → in-app alerts → telegram batch) live + `sendMeTestAlert`; auto-triggers land with ingestion diffing |
| F3.4 | Email alerts + digest (Resend/Postmark per D5) | Not started | Telegram interim per D5 |
| F3.5 | Comparison workspace (2–4 projects, trade-offs) + persistent tray | In progress | No server table for MVP — tray persists in localStorage (D-be1, anonymous-friendly) |

## MVP — Planner & SEO

| # | Feature | Status | Notes |
|---|---|---|---|
| F4.1 | Planner: constraint extraction into typed profile (show/edit) | In progress | Backend live: LLM extracts strict-JSON constraints (verified); show/edit UI pending |
| F4.2 | Transparent weighted ranking + user-adjustable weights | In progress | Deterministic `rankProjects` with per-component reasons live (weights 35/25/20/20); adjustable weights pending |
| F4.3 | Cited AI answers (no uncited project facts; refuse when stale/missing) | In progress | Backend live: narration constrained to retrieved records with mandatory [slug] citations (verified); UI pending |
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
| 2 Aug 2026 | Convex backend live on `judicious-cheetah-253` (dev): schema v1 (17 tables), idempotent seed (2 exercises, 27 towns, 50 stations, 12 projects, 36 flat types, 228 provenance facts, 11 sources), data.gov.sg resale sync (696 rows ingested, job logged) + schools sync, OneMap token/geocode (token refresh verified), alerts engine with Telegram delivery (`send` ok, log written), grounded planner (extraction → deterministic ranking → cited narration; anonymous + authed paths). Gates: `lint` + `typecheck` clean. |
