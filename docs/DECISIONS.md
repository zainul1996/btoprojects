# Decision Log (ADR-lite)

Append-only. Significant decisions get an ID, date, context, decision, and consequence. Reversals are new entries referencing the old ID — never edit history.

## Decided

| ID | Date | Decision | Context & consequence |
|---|---|---|---|
| D0 | 2 Aug 2026 | Build a decision platform, not a news site | Per strategy PDF. Consequence: all MVP scope prioritises structured lifecycle data, comparison and alerts over editorial content. |
| D-stack | 2 Aug 2026 | Next.js (App Router) + Vercel + Convex | Per strategy PDF. No AWS at launch; add infra only on measured bottleneck. |
| D-auth | 2 Aug 2026 | Clerk with Google sign-in; no auth wall for browsing | Fast account flow; Convex integration via Clerk JWT. Gate saves/alerts/history only. |
| D-ai | 2 Aug 2026 | LLM behind provider abstraction; DeepSeek as initial candidate | Model landscape is fast-moving; must stay swappable. Benchmark latency/quality/SG-context/data-handling before committing. Retrieval-first: LLM never answers facts from memory. |
| D-data | 2 Aug 2026 | Provenance-first data model | Every field: value, source URL, retrieved-at, effective date, extraction method, confidence. Consequence: schema carries `projectFacts`/`sources`/`reviewQueue` from day one. |
| D-env | 2 Aug 2026 | CLIs via `npx`, pinned as devDependencies | Convex 1.43.0 / Vercel 58.4.4 verified working via npx; neither installed globally. Node 26 works but Vercel CLI warns (engines ≤ 24) — drop to Node 24 LTS if issues appear. |
| D7 | 2 Aug 2026 | GitHub repo: `zainul1996/btoprojects` | Empty repo created by user; gh CLI has push access. Local-only for now — no Vercel deploy until user asks. |
| D6 | 2 Aug 2026 | OpenRouter as LLM gateway; initial model `deepseek/deepseek-v4-flash-0731` | User-provided key. OpenRouter IS the provider abstraction — swap models via config. Log cost/latency per task. |
| D5 | 2 Aug 2026 | Resend excluded from initial build | Per user: alert engine + in-app notification feed + delivery logs. Interim delivery via Telegram bot adapter (user ID 46868450) once real bot token provided; Resend wired later. |
| D-seed | 2 Aug 2026 | MVP data sourcing: curated seed of ~10 real 2026 projects + live data.gov.sg/OneMap adapters; HDB page-fetcher built but snapshot-based | User-approved. Politer on HDB servers, faster, deterministic. Live HDB fetching deferred to pre-launch hardening. |
| D-flow | 2 Aug 2026 | Build runs fully autonomous, single final review | Per user — no mid-run checkpoints. Quality gates (lint/typecheck/review subagents) run between stages instead. |
| D-cred | 2 Aug 2026 | Credentials received: OneMap, data.gov.sg dev key, OpenRouter, Clerk test keys | Stored ONLY in `.env.local` (gitignored). data.gov.sg key is dev tier — upgrade to prod before heavy ingestion. |
| D-tg | 2 Aug 2026 | Telegram alerts verified end-to-end | Bot `@Zainultestbot` (token live), test message delivered to chat 46868450. Clerk `convex` JWT template confirmed created by user. |
| D-be1 | 2 Aug 2026 | No `comparisons` table — compare tray is client-side localStorage for MVP | Keeps comparison anonymous-friendly per D-auth (no auth wall for browsing). Server-side saved comparisons revisited post-MVP if users ask. |
| D-be2 | 2 Aug 2026 | `mynicehome.gov.sg` counts as `hdb` source kind (with hdb.gov.sg) | HDB's official sales portal; seed source-kind rule ("hdb.gov.sg → hdb, else publisher") extended accordingly. |
| D-be3 | 2 Aug 2026 | Schema v1 omits `projectVersions`, `reviewQueue`, `alertDigests` | Field-level `projectFacts` + `ingestionJobs` cover MVP provenance and parser monitoring; versions + review queue land with the HDB parser pipeline (F1.3/F1.8). |
| D-be4 | 2 Aug 2026 | Planner ranking is deterministic code; LLM only extracts constraints + narrates with [slug] citations | Implements D-ai/D-data guardrails. Ranking weights fixed at 35/25/20/20 (budget/wait/flatType/location) with human-readable reasons; narration failure falls back to a deterministic reply. |
| D-ux1 | 2 Aug 2026 | Validation fixes: watchlist town links via shared `townHref()` (Kallang/Whampoa 404 bug); compare table now SSR via `fetchQuery` (shared links first-paint with real content); watchlist gate SSR via server `auth()` (no flash) | All three surfaced by the validation agent's smoke + UX audit; fixed in-code rather than documented away. |
| D-ux2 | 2 Aug 2026 | Accepted MVP deviations from DESIGN.md: (a) planner constraint chips read-only (correction via chat reply — doc amended); (b) mobile explorer stacks map above list instead of full bottom-sheet-over-map (filters do get a sheet) | Deliberate scope calls, not accidents. Bottom-sheet explorer + inline chip editing are the first V1.x UI upgrades. |
| D-ux3 | 2 Aug 2026 | Pre-launch items (not MVP blockers): Telegram demo-chat fallback means watchers without a chatId share the env demo chat — skip delivery when no user chatId before multi-user; Next 16 `middleware`→`proxy` deprecation warning — rename with Clerk docs verified | Logged from validation's "anything else" notes so they aren't lost. |

## Open questions (resolve before scaffolding — F0.3)

| ID | Question | Options | Lean |
|---|---|---|---|
| D1 | Package manager | npm (present, v11) · pnpm 10 (Vercel ecosystem preference) | npm — simplest, zero install; revisit if workspace/monorepo needs emerge |
| D2 | Monorepo or single app | Single Next.js app with `convex/` inside · pnpm workspaces | Single app — MVP simplicity; ingestion lives in Convex actions |
| D3 | Basemap strategy | OneMap default styles · self-hosted/custom vector tiles (e.g. Protomaps) · commercial (MapTiler/Mapbox) | Evaluate OneMap styles first; strategy forbids assuming OneMap tiles are restylable. Custom light basemap is a design requirement. |
| D4 | Component/UI foundation | Tailwind + shadcn/ui · Tailwind + Radix only | Tailwind + shadcn/ui — speed + the calm, spacious look is achievable; tokens per PRODUCT.md |
| D5 | Email provider | Resend · Postmark | Resend — React Email fits the stack; Postmark if deliverability issues |
| D6 | LLM provider wiring | Direct SDK per provider · Vercel AI SDK as the abstraction | Vercel AI SDK — native Next.js streaming, provider-swappable |
| D7 | Git hosting / CI | GitHub + Vercel Git integration | GitHub — default; confirm account/repo name with user |

## Deferred decisions (not needed yet)

| ID | Question | When to revisit |
|---|---|---|
| D-later-1 | PostHog vs Vercel Analytics only | When funnels/experiments justify (post-launch) |
| D-later-2 | Cloudflare R2 vs Vercel Blob for snapshots | When snapshot volume/cost is measurable |
| D-later-3 | Push notifications (web push vs app) | V2, with draw-an-area alerts |
| D-later-4 | Mobile app (PWA vs native) | "Later" phase per roadmap |
