# Feature Tracker

Single source of truth for implementation status. Update this file whenever work starts or completes (see `AGENT.md` protocol).

Statuses: `Not started` · `In progress` · `Blocked` · `In review` · `Done` · `Deferred`

Last updated: 2 Aug 2026 (post-build sync — first autonomous build complete)

## Phase 0 — Foundation

| # | Feature | Status | Notes |
|---|---|---|---|
| F0.1 | Project documentation set | Done | 2 Aug 2026 |
| F0.2 | CLI access verified (Convex, Vercel via npx) | Done | |
| F0.3 | Resolve open decisions D1–D7 | Done | DECISIONS.md — npm, single app, shadcn, OpenRouter, GitHub repo |
| F0.4 | Scaffold Next.js (App Router, TS strict) + Convex + Clerk | Done | Next 16.2.12, Convex 1.43.0 (dev deployment `judicious-cheetah-253`), Clerk 7.6.4, commit 8d071b7 |
| F0.5 | ESLint flat config incl. @convex-dev/eslint-plugin | Done | Plugin integrated; pre-commit hooks Deferred |
| F0.6 | Design tokens + badge system + app shell | Done | AA-verified palette, 8 trust primitives, commit 5e19dd7 |
| F0.7 | Git repo init + push to GitHub | Done | zainul1996/btoprojects; Vercel link excluded (local-only phase) |

## MVP — Data & ingestion

| # | Feature | Status | Notes |
|---|---|---|---|
| F1.1 | Convex schema v1 (17 tables) | Done | commit a773993; projectVersions/reviewQueue deferred (D-be3) |
| F1.2 | Snapshot storage with content hashing | Deferred | Needs Blob/R2; arrives with live HDB ingestion phase |
| F1.3 | HDB launch/project page adapter | Deferred | Per D-seed: snapshot-based for now, live fetch pre-launch |
| F1.4 | HDB announcements adapter | Deferred | Same as F1.3 |
| F1.5 | data.gov.sg adapters | Done | Resale: 696 real rows synced (job logged). Schools: built, not run. Construction polygons: not yet |
| F1.6 | OneMap client (token cache + auto-refresh, geocode) | Done | 72h JWT cached in kv table, cron refresh |
| F1.7 | LLM fallback extraction | Deferred | With HDB parser phase |
| F1.8 | Reconciliation job + review queue | Deferred | D-be3 |
| F1.9 | Publish → alert trigger chain | Done | alertsEngine.notifyProjectUpdate → watchlist match → Telegram batch |
| F1.10 | Parser monitoring + Sentry | Deferred | ingestionJobs table done; Sentry account pending |
| F1.11 | Seed: 12 real 2026 projects with full provenance | Done | 12 projects, 36 flat types, 228 facts, 11 sources, 27 towns, 50 MRT stations |

## MVP — Explorer & project pages

| # | Feature | Status | Notes |
|---|---|---|---|
| F2.1 | Explorer: list + map + filters (town/region/classification/flat/price/wait/search/sort) | Done | URL state, list↔map focus sync, commit c59f753 |
| F2.2 | MapLibre map with project markers | Done | OpenFreeMap Positron dev basemap (D3 interim); popups, fit-bounds, strict-mode safe |
| F2.3 | Permanent project page (full blueprint) | Done | SSR + provenance badges per fact row, comparables w/ real resale, lifecycle stepper, source log; commit 10e1e24 |
| F2.4 | Exercise pages (/bto/[exercise]) | Done | Stats + grid, soft-404 for unknown keys |
| F2.5 | Town pages (/bto/town/[town]) | Done | Watch-town CTA (signature loop) |
| F2.6 | MRT catchment pages (/bto/near-[mrt]-mrt) | Not started | Backend `mrt.projectsNear` ready; page pending |
| F2.7 | Upcoming page (official vs inferred) | Done | Oct 2026 card labelled Analysis — guardrail satisfied |
| F2.8 | Search + filter URL state | Done | |
| F2.9 | Mobile map UX | Done | Map top + natural-scroll list (bottom-sheet drag simplified away deliberately) |
| F2.10 | "Last verified" + provenance badges on all fact surfaces | Done | |

## MVP — Accounts, watchlists, alerts

| # | Feature | Status | Notes |
|---|---|---|---|
| F3.1 | Clerk auth (Google), browse-without-login | Done | `<Show>` gating; sign-in only for saves |
| F3.2 | Watchlists (project, town, MRT) | Done | Deduped, grouped UI |
| F3.3 | Change detection → alert matching | Done | Engine ready; fires on future ingestion updates |
| F3.4 | Email alerts | Deferred | Resend excluded this phase — **Telegram delivery live instead** (verified end-to-end) + in-app feed + logs |
| F3.5 | Comparison workspace (2–4) + persistent tray | Done | Sticky header/column, best-cell cues, "What you give up" row; localStorage tray (anonymous) |

## MVP — Planner & SEO

| # | Feature | Status | Notes |
|---|---|---|---|
| F4.1 | Planner: constraint extraction (typed, shown as chips) | Done | OpenRouter deepseek-v4-flash; verified extraction |
| F4.1b | Planner: streaming chat UX | Done | AI SDK 7 route handler; phase statuses (reading → searching → ranking → writing), token streaming, markdown + citation links, stop/retry; reasoning tokens excluded for low TTFT |
| F4.2 | Transparent weighted ranking + breakdowns | Done | Deterministic 4-factor score; user-adjustable weights → V1 |
| F4.3 | Cited AI answers ([slug] links only from cited set) | Done | Verified: all 5 narrations cited in round-trip test |
| F4.4 | Planner surface | Done | Full-page chat (mobile + desktop); docked side-panel variant → later |
| F4.5 | SEO hardening | In review | Metadata + canonicals + SSR facts done; sitemap.xml + structured data (BreadcrumbList) pending |
| F4.6 | Analytics (Vercel Web Analytics + events) | Not started | Post-local phase |
| F4.7 | Backfill → 50–100 pages | In review | Currently: 12 projects + 27 towns + 2 exercises + tools ≈ 45 indexable routes; Oct 2025 backfill would push past 50 |

## V1 (post-launch, planned)

| # | Feature | Status | Notes |
|---|---|---|---|
| V1.1 | Profile-based ranking from saved household profile | Not started | userProfiles table ready |
| V1.2 | Commute calculator (OneMap routing) | Not started | onemap.geocode ready; routing adapter pending |
| V1.3 | Affordability scenarios (CPF/grants modelling) | Not started | Indicative strip exists on project page |
| V1.4 | SBF tracker | Not started | |
| V1.5 | Public project change log | Not started | |

## V2 (planned)

| # | Feature | Status | Notes |
|---|---|---|---|
| V2.1 | Draw-an-area search & polygon watchlists | Not started | |
| V2.2 | "Wait or apply?" scenarios | Not started | |
| V2.3 | Construction progress updates | Not started | datagov polygon dataset adapter is the entry point |
| V2.4 | Richer site-plan analysis | Not started | |

## Progress log

| Date | Entry |
|---|---|
| 2 Aug 2026 | Tracker created; F0.1–F0.2 done |
| 2 Aug 2026 | **First autonomous multi-agent build complete** (8 agents: research → scaffold → design system → backend → explorer/pages/workspace → validation). Live local app: 12 real seeded projects w/ provenance, explorer+map, full blueprint pages, compare workspace, watchlist + Telegram alerts (verified), grounded planner w/ citations, 696 real resale rows. All gates green; commits through d01c5f0 on main. Pending from validation: fixes (if any), sitemap/structured data, then docs sync. |
