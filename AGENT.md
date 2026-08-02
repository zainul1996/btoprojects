# AGENT.md — Operating Manual for AI Agents

Read this first before doing any work in this repository. It tells you what this project is, how to work in it, and what must never happen.

## Mission (one paragraph)

BTOProjects.sg is a **decision platform for Singapore HDB BTO buyers** — not a news site. We build a persistent, structured, provenance-first database of every BTO project across its full lifecycle (announcement → launch → application → construction → key collection → SBF → MOP), with an explorer, comparison tools, watchlists with alerts, and a grounded AI planner. The AI is an interface *over* governed data, never the source of truth.

## Repository status

- **Greenfield, docs-only.** No application code has been scaffolded yet.
- Full strategy: `docs/strategy/BTOProjects_SG_Market_Research_and_Product_Strategy.pdf`
- Current phase and next actions: `docs/ROADMAP.md`

## Doc map (keep these current)

| Doc | When to read | When to update |
|---|---|---|
| `docs/PRODUCT.md` | Before any product/UX decision | When strategy changes (rare; confirm with user) |
| `docs/DESIGN.md` | Before building ANY UI — the design constitution | Only with user's agreement |
| `docs/ARCHITECTURE.md` | Before backend/schema/infra work | When architecture decisions are made |
| `docs/DATA_SOURCES.md` | Before ingestion/scraping work | When source terms/endpoints change |
| `docs/ROADMAP.md` | At the start of every session | When a sprint/milestone status changes |
| `docs/FEATURES.md` | At the start of every session | **Every time** you start or finish a feature |
| `docs/DECISIONS.md` | Before changing anything already decided | When a significant decision is made or reversed |

**Status-tracking protocol (mandatory):**
1. Starting work on a feature → set it `In progress` in `docs/FEATURES.md`.
2. Completing work → set it `Done`, add a dated entry to the progress log at the bottom of `docs/FEATURES.md`.
3. Making a non-obvious decision (library choice, schema shape, trade-off) → append to `docs/DECISIONS.md`.
4. Never let these files drift more than one session behind reality.

## Stack & commands

Next.js (App Router) + Vercel + Convex + Clerk + MapLibre GL + OneMap. See `docs/ARCHITECTURE.md`.

```bash
# Development (once scaffolded)
npm run dev            # Next.js dev server
npx convex dev         # Convex dev deployment — the ONLY backend command for development

# Quality gates (must pass before considering work done)
npm run lint           # ESLint incl. @convex-dev/eslint-plugin
npm run typecheck      # tsc --noEmit
```

**Never run `npx convex deploy` during development.** Deploy is production-only, and only when the user explicitly asks.

CLIs are available via `npx` (Convex 1.43.0, Vercel 58.4.4 verified); neither is installed globally. Prefer project-local devDependencies when scaffolding.

## Non-negotiable product guardrails

These come straight from the strategy. Violating them is worse than not shipping.

1. **Provenance first.** Every fact stored carries: value, source URL, retrieved-at, effective date, extraction method, confidence. No field without a source trail.
2. **Label everything** as `official` / `estimated` / `analysis`. Never blur these categories in the UI or in AI output.
3. **The LLM never answers project facts from memory.** Retrieval from Convex first; answers must cite records. Refuse or qualify when data is missing or stale.
4. **No certainty theatre.** No ballot-odds predictions presented as fact, no "best unit" claims without site-plan data, no automated future resale valuation — use "scenario estimate" / "comparable-based range" language with methodology shown.
5. **No auth wall for browsing.** Sign-in (Clerk) only gates saves, alerts and personalised history.
6. **"Upcoming" must separate official announcements from inferred/editorial expectations.**
7. **Respect source terms.** Confirm robots.txt, API quotas and Open Data Licence obligations before any production ingestion (`docs/DATA_SOURCES.md`).

## Convex engineering rules (summary — enforced by workspace rules + ESLint)

- Every public `query`/`mutation`/`action` defines `args` **and** `returns` validators.
- `await` every promise (`ctx.db.*`, `ctx.scheduler.*`); no floating promises.
- Auth: verify `ctx.auth.getUserIdentity()` in every public function touching user data; prefer custom-function wrappers (`convex-helpers`) over repeated checks.
- Never `Date.now()` inside queries — pass time as an argument or use status fields maintained by cron.
- Use `.withIndex()`; avoid `.filter()` table scans. Index all foreign keys in `schema.ts`.
- Paginate with `.paginate()` for any unbounded list; no unbounded `.collect()`.
- Scheduler only runs `internal*` functions, never public `api.*` functions.
- Node APIs (fetch to externals, crypto, SDKs) only in `action` files starting with `"use node"`; such files must not export queries/mutations. Actions write to the DB via `ctx.runMutation`.
- Keep `query`/`mutation`/`action` wrappers thin; business logic lives in plain TypeScript functions.
- TypeScript strict mode, no `any`. Use generated `Doc<>`/`Id<>` types.
- Flat, relational schema; IDs across tables instead of deep nesting.

## SEO & rendering rules (when building the frontend)

- Server-render all fact content; nothing critical behind client-only map or chat.
- Stable project slugs, canonical URLs, XML sitemaps per content family, BreadcrumbList schema.
- Preserve historical project pages; redirect renamed projects, never delete.
- Every page shows "last verified" and a human-readable source trail.

## Definition of done (any task)

1. Code passes `lint` + `typecheck`.
2. Facts rendered in UI carry provenance and confidence labeling where applicable.
3. `docs/FEATURES.md` (and `docs/ROADMAP.md` / `docs/DECISIONS.md` if relevant) updated.
4. No secrets committed; credentials via env vars only (see `docs/DATA_SOURCES.md` for required keys).

## Working style for this repo

- The user reviews plans before big implementations. For anything architectural, present the plan first.
- Ship the boring, reliable version first (strategy explicitly warns against overbuilding).
- When unsure about a product trade-off, re-read `docs/PRODUCT.md` — especially "What not to build".
