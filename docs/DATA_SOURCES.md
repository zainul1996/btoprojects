# Data Sources & Provenance

**Core principle: provenance first.** Every field stores value, source URL, retrieved time, effective date, extraction method and confidence. AI may transform or summarise; it never silently becomes the source of truth.

> Verified against official docs, 2 Aug 2026. Re-verify terms before production ingestion.

## Source matrix

| Data | Primary source | Method | Refresh | Notes |
|---|---|---|---|---|
| Launch/project facts | HDB sales exercise & project pages | Fetch + deterministic parser; LLM fallback on layout change | Daily; hourly in launch week | Store snapshots + diffs |
| Upcoming exercises | HDB announcements/news releases | Structured extraction | Daily | Label `official` only when published by HDB |
| SBF inventory | HDB sales exercise pages | Fetch + parser | Daily during exercise | Never "predict" exact units |
| Construction polygons | data.gov.sg HDB under-construction (GeoJSON) — dataset `d_930e662ac7e141fe3fd2a6efa5216902` | API/download ingestion | Weekly | Project geometry + status |
| Resale transactions | data.gov.sg resale prices (Jan 2017+) — `d_8b84c4ee58e3cfc0ece0d773c8ca6abc`; medians — `d_b51323a474ba789fb4cc3db58a3116d4` | API/download ingestion | Daily/weekly | Comparables only, not future value |
| Schools | MOE school directory, data.gov.sg — `d_688b934f82c1059ed0a6993d2a829089` | API/download + geocode | Quarterly/monthly | Distance only; no admissions claims |
| Routes/amenities | OneMap search, routing, themes | Authenticated API + caching | On demand + scheduled cache | Respect quotas & terms |
| Planning context | URA public plans/releases | Approved datasets / manual curation | Monthly | Separate adopted plans from speculation |
| Editorial analysis | Own rules + LLM summarisation | Change-triggered enrichment | On source change | Publish assumptions + confidence |

## API specifics (verified)

### data.gov.sg

- Dataset search: `GET https://data.gov.sg/api/action/datastore_search?resource_id={datasetId}` (limit/offset/filters/sort params)
- Bulk download (two-step): `GET https://api-open.data.gov.sg/v1/public/api/datasets/{datasetId}/initiate-download` → `GET .../poll-download`
- Rate limits per 10s: **no key** — datastore 4, downloads 2; **dev key** — 8/4; **prod key** — 20/10. Exceeding → HTTP 429.
- Action: register an account and use a production API key before launch. Free for commercial/personal use; check Singapore Open Data Licence attribution requirements.

### OneMap (SLA)

- Auth: `POST https://www.onemap.gov.sg/api/auth/post/getToken` with registered `{email, password}` → JWT `access_token` + `expiry_timestamp`.
- **Token TTL = 3 days, no auto-renew.** Implement cached token + auto-refresh (Convex cron or lazy refresh-on-401 with retry).
- Token required for Search (elastic search) and Routing; **not** required for basemap tiles / static map API.
- Send token in `Authorization` header. Avoid repeated `getToken` calls (rate-limit bans).
- Do **not** assume OneMap tiles can be restyled — use its published basemap styles or a separate licensed/custom vector-tile source, overlaying OneMap-derived data.

### HDB web pages

- No official API for BTO launch/project pages → fetch + snapshot + deterministic parsing.
- Before production: review robots.txt/terms, keep request rates polite (cache headers, backoff), and design parsers to fail loudly into the review queue rather than silently mis-extract.

### URA

- Use approved/public datasets only; manual curation acceptable in MVP. Keep adopted plans strictly separated from speculation in the UI.

## Provenance record (per stored fact)

```ts
{
  value: unknown,              // the fact
  sourceUrl: string,           // where it came from
  retrievedAt: number,         // when we fetched it
  effectiveDate?: number,      // when the fact applies from
  extractionMethod: "parser" | "llm" | "manual",
  confidence: "official" | "estimated" | "analysis",
  contentHash: string,         // snapshot identity
  snapshotRef?: string         // Blob/R2 key for the raw artefact
}
```

UI renders a `official / estimated / analysis` badge from `confidence` and a "last verified" timestamp from `retrievedAt`.

## Required environment variables (once ingestion exists)

```
ONE_MAP_EMAIL=            # OneMap registered account
ONE_MAP_PASSWORD=
DATAGOV_API_KEY=          # production-tier key
RESEND_API_KEY=           # or POSTMARK_*, pending D5
LLM_PROVIDER_API_KEY=     # provider-abstraction env name TBD
CLERK_SECRET_KEY= / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

Never commit secrets; store in `.env.local` (gitignored) and Vercel/Convex environment settings.

## Pre-production compliance checklist

- [ ] HDB site terms & robots reviewed; polite crawl policy implemented
- [ ] data.gov.sg production API key obtained; Open Data Licence attribution displayed
- [ ] OneMap account registered; quota monitoring + token auto-refresh tested
- [ ] URA dataset terms confirmed
- [ ] Snapshot storage working with content-hash dedup
- [ ] Review queue triage process defined (who approves conflicts, SLA)
