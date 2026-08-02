# Architecture

Stack verdict (from strategy): **Next.js + Vercel + Convex is enough for the MVP.** No AWS at launch; add specialised infrastructure only when a measured bottleneck appears. The one hard requirement: separate ingestion/background work from user-facing rendering.

## System overview

```
                        ┌────────────────────────────────────────────┐
                        │                 Vercel                     │
                        │   Next.js App Router (SSR/ISR, SEO pages)  │
                        └───────────────┬────────────────────────────┘
                                        │ Convex React (realtime)
        ┌───────────────────────────────▼───────────────────────────────┐
        │                            Convex                             │
        │  projects · exercises · facts(provenance) · sources · users   │
        │  watchlists · alerts · comparisons · planner sessions · jobs  │
        │                                                               │
        │  queries/mutations (user-facing)                              │
        │  internal mutations/actions (ingestion, alerts)               │
        │  crons: daily/hourly source polls, alert dispatch             │
        └───┬───────────────┬───────────────┬───────────────┬──────────┘
            │               │               │               │
     ┌──────▼─────┐  ┌──────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
     │ HDB pages  │  │ data.gov.sg │  │  OneMap    │  │ LLM API    │
     │ (fetch +   │  │ datasets    │  │ geocode /  │  │ (provider- │
     │ parser)    │  │ (API keys)  │  │ routing    │  │ abstracted)│
     └────────────┘  └─────────────┘  └────────────┘  └────────────┘

     Snapshots (raw HTML/JSON/PDF + hashes) → Vercel Blob → Cloudflare R2 later
     Auth: Clerk (Google) · Email: Resend/Postmark · Monitoring: Sentry
```

## Layer choices

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js App Router | SSR for all fact pages; route-level caching; image optimisation |
| Backend/DB | Convex | Realtime queries, scheduled functions, jobs, all app state |
| Auth | Clerk + Google | Browse anonymously; gate saves/alerts/history only |
| Maps | MapLibre GL JS | Custom light basemap; polygons, catchments, draw tools |
| Gov geo | OneMap APIs | Geocoding/routing/themes; JWT auth, 72h token TTL — cache + auto-refresh |
| Email | Resend or Postmark | Open question — see `DECISIONS.md` D5 |
| Scheduler | Convex crons primary; Vercel Cron where HTTP-side | Daily/hourly ingestion |
| Snapshots | Vercel Blob → R2 | Raw source artefacts + hashes outside primary records |
| AI | Provider abstraction; DeepSeek initial | Route tasks by cost/quality; log latency/quality/cost |
| Analytics | Vercel Web Analytics | PostHog only when funnels justify it |
| Monitoring | Sentry + structured job logs | Parser failure & source-change detection |

## Convex schema sketch (v0 — refine when implementing)

Relational and flat; every factual field traces to a source record. Illustrative, not final:

```
exercises        — BTO/SBF sales exercise (e.g. "2026-10", type bto|sbf, status, dates)
projects         — canonical project record: slug, name, town, region, classification
                   (Standard|Plus|Prime), lifecycleStatus, geo (centroid/polygon ref)
projectVersions  — point-in-time fact sets per project per exercise (prices, flat mix,
                   unit counts, wait time, restrictions) → enables change history
projectFacts     — field-level provenance: projectId, field, value, confidence,
                   sourceId, extractedBy (parser|llm|manual), effectiveDate
sources          — source documents: url, type (hdb_page|datagov|onemap|pdf),
                   retrievedAt, contentHash, snapshotRef (Blob/R2 key)
reviewQueue      — material conflicts from reconciliation; human approve/reject
towns / mrtStations / schools
                 — reference entities with geometry
resaleTransactions
                 — comparables ingest from data.gov.sg (block, street, flatType,
                   storey, area, price, month, town)
users            — profile mapped from Clerk identity
userProfiles     — planning constraints: budget, household, workplaces[], parentsArea,
                   waitTolerance, flatTypes[]  (sensitive: minimal + encrypted fields)
watchlists       — userId, targetType (project|town|mrt|polygon), targetRef/geometry,
                   alertChannels, cadence
alerts           — userId, watchlistId, changeRef, status (pending|sent), sentAt
comparisons      — userId (or anon session), projectIds[]
plannerSessions  — conversation turns, interpreted constraints, cited projectIds
ingestionJobs    — sourceId, status, startedAt, error, stats (parser monitoring)
alertDigests     — batched email state per user
```

Indexes on all foreign keys (`by_project`, `by_user`, `by_exercise`, `by_town`, `by_status` etc.). Every list endpoint paginates.

## Ingestion pipeline (7 stages)

1. **Scheduler** triggers source adapters (Convex crons → internal actions). Fetch with caching headers + rate limits.
2. **Snapshot** raw HTML/JSON/PDF stored with content hash (Vercel Blob). Skip unchanged content by hash.
3. **Deterministic parse** extracts stable fields; schema validation rejects impossible values.
4. **LLM fallback** — only changed/unparsed sections go to the LLM for structured extraction (marked `extractedBy: llm`).
5. **Reconciliation** compares new facts vs existing records; material conflicts → `reviewQueue`.
6. **Atomic publish** — approved changes publish, invalidate caches, trigger matching watchlist alerts.
7. **Transparency** — every page shows "last verified" + human-readable source trail.

## AI architecture (interface over governed data)

| Layer | Approach | Guardrail |
|---|---|---|
| Query understanding | Extract constraints into typed profile | Show/edit interpreted preferences |
| Retrieval | Structured Convex queries first; semantic search for long text | Never answer facts from model memory |
| Ranking | Transparent weighted score + LLM explanation | Expose why each ranked; user-adjustable weights |
| Estimates | Statistical baseline from comparables; LLM narrates | Publish range, date, assumptions, uncertainty |
| Answering | Cited responses linking project/source records | Refuse/qualify when data missing or stale |
| Routing | Cheap model for chat/extraction; stronger for synthesis | Log quality/latency/cost per task |

Language discipline: "scenario estimate" / "comparable-based range" — never "valuation".

## Frontend route map (SEO families)

```
/                        — home → explorer
/explore                 — map + list + timeline
/upcoming                — announced vs inferred, clearly separated
/projects/[slug]         — permanent project page (canonical, never deleted)
/bto/[exercise]          — e.g. /bto/october-2026
/bto/town/[town]         — town pages with price history
/bto/near-[mrt]-mrt      — MRT catchment pages
/bto/[attribute]         — /bto/3gen, /bto/short-waiting-time (curated only)
/compare/[a]-vs-[b]      — comparison pages
/tools/affordability, /tools/commute, /tools/launch-calendar
/guides/[topic]          — evergreen (HFE, SBF, grants...)
/watchlist, /planner     — authenticated app surfaces
```

SSR all fact content; canonical URLs; sitemaps per family; BreadcrumbList structured data; no fabricated ratings.

## When AWS becomes justified (defer until measured)

Large-scale geospatial processing/tile generation · high-volume crawling beyond serverless limits · heavy PDF processing + durable queues · cost/compliance inflection.
