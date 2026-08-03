# Data Sources & Provenance

**Core principle: provenance first.** Every field stores value, source URL, retrieved time, effective date, extraction method and confidence. AI may transform or summarise; it never silently becomes the source of truth.

> Verified against official docs, 2 Aug 2026. Re-verify terms before production ingestion.

## Source matrix

| Data | Primary source | Method | Refresh | Notes |
|---|---|---|---|---|
| Launch/project facts | HDB Flat Portal application-rate JSON (`services-homes.hdb.gov.sg`, robots-allowed); project pages later | Fetch + deterministic parser; LLM fallback on layout change | Daily (02:23 SGT cron) | No prices/completion in JSON — seeded until MyNiceHome parser track |
| Upcoming exercises | HDB announcements/news releases | Structured extraction | Daily | Label `official` only when published by HDB |
| SBF inventory | HDB sales exercise pages | Fetch + parser | Daily during exercise | Never "predict" exact units |
| Construction polygons | data.gov.sg HDB under-construction (GeoJSON) — dataset `d_930e662ac7e141fe3fd2a6efa5216902` | API/download ingestion | Weekly | Project geometry + status |
| Resale transactions | data.gov.sg resale prices (Jan 2017+) — `d_8b84c4ee58e3cfc0ece0d773c8ca6abc`; medians — `d_b51323a474ba789fb4cc3db58a3116d4` | API/download ingestion (streaming windowed parse — Convex 64MB heap) | Twice monthly, 10th & 20th (03:07 SGT cron) | Comparables only, not future value |
| Project geocodes | OneMap elastic search | Authenticated API + town-fallback tiers | Daily (04:11 SGT cron; zero calls when fresh) | Shared token cache with runtime `onemap_token` |
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

## 3 Aug 2026 — HDB BTO launch ingestion source selection (Track W1, `convex/ingest/hdb.ts`)

**Chosen source: HDB Flat Portal application-rate JSON files** — official, machine-readable, no auth, robots-clean.

| Candidate | Verdict | Why |
|---|---|---|
| `services-homes.hdb.gov.sg/sales/files/apprates/BTO{YYYYMM}.json` | **CHOSEN** | Static JSON behind the public "Flat Supply & Applications Received" pages. Per exercise: application window (`launch_start_date`/`launch_end_date`), `is_final_update`, per estate×flat-type rows with project names, classifications, `flat_supply`, applicant counts and application rates. |
| `POST services-homes.hdb.gov.sg/api/bp29/sf/v1/get-launch-availability` (and `get-launch-details`) | Secondary signal | The Flat Portal SPA's own API (base URL from `/sales/app_info/app_info.js`). GET 403s (`MissingAuthenticationTokenException` — API Gateway); **POST works** with `Content-Type: application/json` + a random-UUID `Salesform-Id` header. Returns `{"code":2002,"message":"There is no sales launch at the moment."}` between exercises; during a window it carries the active `launch_qtr`. Used only to detect off-cycle launches. |
| data.gov.sg catalogue | Rejected for launches | Only aggregate HDB statistics (price ranges by FY `d_2d493bdcc1d9a44828b6e71cb095b88d`, bookings `d_e6079cb5bf0c2450372b1054f37e6e79`, units sold/rented `d_67966e5fd5dce14cf9fa5f0bc5164faf`). No per-launch/per-project BTO dataset exists. `api-production.data.gov.sg/v2/public/api/datasets?search=` ignores the search term (returns a fixed list) — catalogue search is effectively broken; dataset discovery via web search instead. |
| `www.hdb.gov.sg` BTO pages / press releases | Rejected (for now) | robots.txt allows content paths (`Allow: /`, only e-service/transactional paths disallowed), BUT the site WAF returns 403 for non-browser User-Agents — even `GET /robots.txt` needs a browser UA. Press-release HTML parsing remains a future option for *pre-launch* announcements (town lists, next-exercise dates). |
| `www.mynicehome.gov.sg` sales-launch pages | Rejected (for now) | robots allows (`Allow: /` except `/search`), but pages are Next.js RSC payloads (~860 KB HTML) — brittle to parse. Carries prices/waiting times the apprates JSON lacks; candidate for a later snapshot+parser track. |

**robots.txt verdicts (fetched 3 Aug 2026):**
- `services-homes.hdb.gov.sg/robots.txt` → `User-agent: *` / `Allow: /` — full crawl permission.
- `www.mynicehome.gov.sg/robots.txt` → `Allow: /`, `Disallow: /search`.
- `www.hdb.gov.sg/robots.txt` → long e-service disallow list + final `Allow: /`; sitemap at `/sitemap.xml`. No BTO/content path disallowed; WAF is the practical blocker, not robots.

**Chosen-source specifics:**
- URL pattern: `https://services-homes.hdb.gov.sg/sales/files/apprates/BTO{YYYYMM}.json` (e.g. `BTO202606.json`); SBF equivalents exist as `SBF{YYYYMM}.json` (ingested since 3 Aug 2026 — see SBF section below).
- Missing quarters 302 → `/sales/error/404`; fetch with `redirect: "manual"` and treat non-200/non-JSON as absent.
- Retention appears to be recent exercises only: on 3 Aug 2026, `BTO202602` and `BTO202606` resolve; `BTO202510` and older already 302. **Run regularly; no backfill possible from this source.**
- A quarter's file appears when the exercise opens — pre-launch discovery is impossible here.
- Request budget per run: 1 POST (live signal) + ≤12 GET probes (BTO Feb/Jun/Jul/Oct + SBF Feb × current+previous SGT year, +next Feb in Nov/Dec, +live quarter both kinds), serial with 400 ms gaps. Descriptive UA `BTOProjects.sg launch-ingest/1.0` is accepted (no WAF on this host).

**What the source yields vs what `projects` wants (gap list):**

| Field | In source? | Ingestion behaviour |
|---|---|---|
| exercise key/label/window (`applicationEnd`) | ✅ `launch_start/end_date` | exercises upsert; `applicationDeadline` fact per project (official) |
| project name + town | ✅ | match by normalised name+town; shell created if new |
| classification (Standard/Plus/Prime) | ✅ per project | fact `classification` (official) |
| totalUnits | ⚠️ partial | only when every estate row naming the project is single-project (verified: sums match seed, e.g. Redhill Peaks 1052) |
| flat-type units | ⚠️ partial | only single-project rows; shared rows (split unpublished) skipped; `5-Room/3Gen` combined rows stored verbatim as `flatType.5-Room/3Gen.units` |
| applications received per row | ✅ `total_applicant_no` | fact `flatType.<label>.applicants` (official) — demand signal for BTO and SBF |
| prices (min/max per flat type) | ❌ | needs MyNiceHome/press-release parser |
| estimatedCompletion / wait months | ❌ | needs MyNiceHome (waiting-time text) or manual research |
| lat/lng, nearest MRT, schools | ❌ | OneMap geocode track (W1 parallel agent) |

## SBF application-rate files (since 3 Aug 2026)

- Same host, same shape: `SBF{YYYYMM}.json` (verified `SBF202602` = 4,320 units / 24 towns / 80 rows, matching HDB's Feb 2026 press release exactly; `SBF202502` and older already 302 — same recency retention).
- SBF cadence: **one exercise each February** since 2024, alongside the Feb BTO. Composition is revealed only on launch day, so the Feb probe + live-quarter signal are the discovery mechanism.
- Rows are town-level pools: `project_name == estate_name`, sometimes listed several times per row with different classifications (`NA` / `Plus` / `Prime` / `Standard`). The duplicates are the SAME pool split by classification — supply is the pool total (unlike BTO shared rows, where splits are unpublished). Pool classification lands on "Unclassified" unless uniform.
- Flat types outside the BTO union (`Community Care Apartment`, `5-Room/3Gen`, `5-Room/Executive`) are stored as verbatim facts, never guessed into the union.
- No prices anywhere in SBF files — starting prices live in the launch-day press release annex (WAF-blocked on hdb.gov.sg; mirrors like ERA/99.co carry them — secondary-confidence extraction is a P3 track).
- Town quirks: `Kallang Whampoa` → aliased to `Kallang/Whampoa`; `Jurong East/ West` is HDB's own lumping, kept verbatim with a dedicated towns row (midpoint coords).
