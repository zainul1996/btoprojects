# Product Strategy (condensed)

Source: `docs/strategy/BTOProjects_SG_Market_Research_and_Product_Strategy.pdf` (2 Aug 2026). This file is the working summary — the PDF remains the authority.

## Positioning

> **"Plan your HDB home with confidence."**

The buyer's planning layer above official data. HDB provides authoritative facts; publishers provide launch-by-launch commentary. The open space is a persistent, structured, personalised product answering: *"Which project fits my life, and what should I do next?"*

- **MVP focus:** Discovery + alerts
- **Core moat:** Structured lifecycle data, user preference graph, change history, alert relationships — not the LLM
- **One-sentence MVP:** A beautiful map-and-list explorer of every BTO project, with evidence-rich pages, comparison, a grounded planner and alerts for projects or areas.

## North-star experience

One conversation, one living shortlist. A user states budget, workplaces, parents' location, flat size and wait tolerance; the system converts this to constraints, shows a ranked shortlist with explanations and evidence links, and lets the user follow projects or areas.

**North-star metric:** % of active users who create a shortlist or watchlist after viewing project evidence.

## What to build first

1. Interactive launch explorer — list + map + timeline, filterable by town, region, MRT, price, flat type, waiting time, classification, launch status
2. Permanent project pages — one consistent schema: prices, flat mix, classification, wait time, transport, schools, amenities, site-plan observations, trade-offs, comparable resale, source history, lifecycle status
3. Conversational planner — budget/household/workplaces/parents/wait tolerance → ranked projects with explanations
4. Watchlists — projects, towns, MRT catchments, drawn areas; email/push alerts on HDB announcements, launches, updates, relevant SBF
5. Comparison workspace — 2–4 projects side by side: commute, affordability, wait, amenities, restrictions, "what you give up"

## What NOT to build (MVP)

- Ballot-odds predictions presented as certainty
- Stack-level "best unit" recommendations before site-plan data exists
- Automated future resale valuation marketed as a promise
- Social network / forum / agent marketplace
- Authentication before browsing (sign-in only for saves, alerts, history)

## User segments → product response

| Segment | Primary question | Response |
|---|---|---|
| Early planner | What's coming near parents/workplace? | Area watchlists, timeline, map, notifications |
| Active applicant | Which launch should I apply for? | AI shortlist, comparison, affordability, trade-offs |
| Specific-needs buyer | Any 3Gen / short-wait / 5-room options? | Flat-type/feature filters, saved search |
| Unsuccessful applicant | Wait, SBF, or resale? | Alternative path comparison + alerts |
| Post-booking owner | What changed, when completion, what's nearby? | Construction lifecycle, neighbourhood updates |
| Researcher | How did this town evolve? | Historical explorer, downloadable summaries |

## Primary navigation

Explore · Upcoming · Projects · Compare · Planner · Watchlist

## Project page blueprint

Decision summary (who it suits, strengths, compromises, confidence, last-updated) · Official facts (exercise, town, flat types, unit counts, prices, wait, classification, restrictions) · Location (map, walking routes, MRT/bus, schools, parks, food, healthcare, workplaces) · Affordability (cash/CPF scenarios, mortgage range, grants links) · Comparables (nearby resale, town medians, methodology) · Site analysis (orientation, noise, facilities — labelled as analysis) · Lifecycle timeline · Source log (links, extracted fields, update history, corrections)

## Design direction

Calm financial-planning product, not property classifieds: spacious, evidence-led, map-forward, no aggressive lead forms.

- **Colour:** deep navy, teal, warm off-white, restrained coral for warnings
- **Type:** Inter/Geist-class clean sans; large numeric hierarchy
- **Cards:** low-border, generous spacing, clear official/estimated/analysis badges
- **Map:** MapLibre with custom light basemap; project polygons as dominant layer
- **Mobile:** bottom sheet over map, sticky compare tray, full-screen planner
- **AI:** docked right panel desktop / full-screen sheet mobile; citations inside answers

## Monetisation (follows trust — sequence)

1. Free product + email alerts; validate acquisition and repeat usage
2. Contextual partner referrals (mortgage/renovation/conveyancing) only after user explicitly asks
3. Paid "Home Plan" (~S$4–12/mo or one-off report): unlimited comparisons, scenario history, household collaboration, custom area alerts, downloadable reports
4. Anonymised/aggregated market intelligence or API (subject to licences/privacy review)

Controls: clearly labelled sponsorship, never alter rankings, user-initiated contact only, strict separation of sponsored vs editorial/official content.

## Principal risks → mitigations

| Risk | Mitigation |
|---|---|
| Source fragility (HDB layout changes) | Snapshot + hash, schema validation, parser tests, manual review queue |
| Trust/liability (mistaken predictions) | Separate fact/estimate/analysis; ranges + methodology; no guarantees |
| SEO dependence (big publishers outrank) | Tools, alerts, unique datasets, internal links, email retention |
| API quotas/terms (OneMap etc.) | Cache, batch, monitor quotas, maintain fallbacks |
| Model risk (cost/hallucination) | Provider abstraction, retrieval-first, deterministic checks |
| Privacy (income/work/family locations) | Minimise collection, encrypt sensitive fields, granular deletion, clear consent |
| Overbuilding | Ship project database + watchlists before advanced predictions |
