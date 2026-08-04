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

## Map amenity layers

The `amenities` table is the shared point-data foundation for optional map
layers. MRT/LRT stations remain in `mrtStations`. Schools remain in `schools`
until an official dataset or documented geocoder supplies coordinates.

Every published amenity has:

- a stable dataset key and source record ID for idempotent updates
- a `sources` record with publisher, URL and retrieval time
- a buyer-facing category and source-stated `current` or `planned` status
- coordinates plus `exact` or `approximate` geometry disclosure
- a point role of `site`, `entrance` or `centroid`
- a last-verified timestamp and optional effective date

Ingestion adapters must skip records without coordinates. They must not infer
`planned` or `current` from a name, date or map symbol. If a source does not
state status, the adapter needs an explicit documented rule before activation.
Approximate or centroid points must not be used for precise walking-distance
claims.

The public query accepts one category and a viewport. Fixed spatial cells keep
reads bounded. It returns `requiresCloserZoom` when the viewport is too large
and `truncated` when a dense cell or result limit prevents complete display.
The UI must preserve those states and must not imply that hidden results do not
exist.

### Category readiness

Only categories with a completed, reviewed ingestion adapter may appear as
available map switches. A schema category is not evidence that its dataset has
been loaded.

| Category | Candidate source | Readiness and caveat |
|---|---|---|
| MRT and LRT | LTA station exits via data.gov.sg, dataset `d_b39d3a0871985372d7e1637193335da5` | Static layer active for 183 named station groups. Markers are approximate exit centroids and the source has no current/planned field. |
| Hawker centres | NEA via data.gov.sg, dataset `d_4a086da0a5553be1d89383cd90d07ecd` | Static layer active for 129 usable official points with source-stated status. |
| Supermarkets | SFA via data.gov.sg | Blocked. The former GeoJSON dataset `d_cac2c32f01960a3ad7202a99c27268a0` and KML dataset `d_8a77ee0446716b2ce475a587004afc73` both return `DATASET_DOES_NOT_EXIST` from the official download API. Collection 1451 has no current child datasets. The map must not offer this layer until SFA republishes an authoritative location download. |
| Primary schools | MOE directory `d_688b934f82c1059ed0a6993d2a829089` plus SLA OneMap Search | Static layer active for 182 primary and P1-S4 mixed-level schools. MOE supplies names and addresses. OneMap supplies approximate site coordinates. These markers do not determine Primary 1 distance eligibility. |
| Childcare | ECDA via data.gov.sg, dataset `d_696c994c50745b079b3684f0e90ffc53` | Official candidate. Review vacancy and operating-status semantics separately from location. |
| Parks | NParks Parks and Nature Reserves `d_77d7ec97be83d44f61b85454f844382f` | Static layer active for 461 managed-area polygons. Markers are area-weighted representative centroids, not entrances or exact usable points. |
| Park connectors | NParks via data.gov.sg, including dataset `d_a69ef89737379f231d2ae93fd1c5707f` | Linear geometry is not represented as point markers. Keep unavailable until the map supports lines or an official entrance dataset is approved. |
| Sports facilities | Sport Singapore via data.gov.sg, dataset `d_9b87bab59d036a60fad2a91530e10773` | Official candidate. Confirm public access and operating status fields before enabling. |
| Community facilities | People's Association via data.gov.sg, dataset `d_9de02d3fb33d96da1855f4fbef549a0f` | Official candidate. Classify only facilities relevant to the displayed community layer. |
| Bus stops | LTA DataMall Bus Stops API | Official candidate. Requires DataMall access and is dense, so it should be zoom-gated. |
| Healthcare | MOH, HealthHub or a reviewed OneMap theme | No single complete point source has been approved. Keep unavailable until coverage and update ownership are clear. |
| Libraries | NLB or a reviewed government dataset | No adapter yet. Verify location coverage and stable IDs before enabling. |
| Shopping malls | No complete government dataset approved | Do not present OneMap search results or community-maintained data as an exhaustive official list. Any attributed secondary dataset needs coverage disclosure. |
| Places of worship | Reviewed OneMap themes or agency datasets | No adapter yet. Use neutral category labels and disclose coverage. |

### Production-safe hawker snapshot

The first non-rail layer is committed at
`public/data/amenities/hawker-centres.json`. It contains the 129 usable points
retrieved from NEA's official GeoJSON snapshot on 4 Aug 2026. The browser may
fetch this local file without Convex deployment changes, credentials or a
runtime data.gov.sg request.

The JSON contract is:

```ts
{
  schemaVersion: 1;
  category: "hawker";
  dataset: {
    id: string;
    publisher: "National Environment Agency";
    sourceUrl: string;
    licenseUrl: "https://data.gov.sg/open-data-licence";
    retrievedAt: string;
  };
  items: Array<{
    id: string;
    name: string;
    status: "current" | "planned";
    sourceStatus: string;
    address?: string;
    lat: number;
    lng: number;
    geometryAccuracy: "exact";
    geometryRole: "site";
    sourceUpdatedAt?: string;
    cookedFoodStalls?: number;
  }>;
}
```

The transformer maps NEA's explicit `Under Construction` value to `planned`.
`Existing`, `Existing (new)`, `Existing (replacement)` and `Interim Centre`
map to `current`. Unknown statuses are counted and skipped instead of guessed.

Refresh with an explicit retrieval time so generated diffs are reproducible:

```bash
node scripts/sync-hawker-centres.mjs \
  --retrieved-at 2026-08-04T00:19:40Z
```

Use the actual UTC retrieval time for a new snapshot. The script calls the
official unauthenticated initiate-download and poll-download endpoints, checks
stable identities and Singapore point coordinates, sorts by NEA `OBJECTID`,
and reports every skipped identity, geometry or status row. Review the JSON
diff before committing it.

### Production-safe MRT and LRT snapshot

`public/data/amenities/train-stations.json` uses LTA's MRT Station Exit GeoJSON
dataset `d_b39d3a0871985372d7e1637193335da5`. Despite the dataset title, it
includes both MRT and LRT exits. The 4 Aug 2026 snapshot contains 613 exits and
183 named station groups: 142 MRT and 41 LRT. Seven groups whose source label
contains only a code are counted and omitted. This is named-station coverage
from LTA exit data, not a claim of complete islandwide rail coverage.

Each marker is the arithmetic centroid of its official exits. It is labelled
`approximate` with geometry role `centroid`, so it must not be described as a
station entrance or used for entrance-level walking claims. The source has no
operating or construction status field. The UI may call the layer MRT/LRT but
must not infer current or planned status.

The generator merges code and line labels from `docs/seed/mrt.json` only when
the normalized source name matches exactly one official station group. This
adds curated metadata to 48 markers. Choa Chu Kang and Punggol are deliberately
not merged because each name identifies separate MRT and LRT groups.

```bash
node scripts/sync-train-stations.mjs \
  --retrieved-at 2026-08-04T00:23:31Z
```

Its JSON contract is:

```ts
{
  schemaVersion: 1;
  category: "train_station";
  dataset: {
    id: string;
    publisher: "Land Transport Authority";
    sourceUrl: string;
    licenseUrl: "https://data.gov.sg/open-data-licence";
    retrievedAt: string;
  };
  coverage: {
    stationExits: number;
    stations: number;
    mrt: number;
    lrt: number;
    skippedCodeOnly: number;
    curatedCodeMatches: number;
  };
  items: Array<{
    id: string;
    name: string;
    officialName: string;
    mode: "mrt" | "lrt";
    code?: string;
    line?: string;
    lat: number;
    lng: number;
    geometryAccuracy: "approximate";
    geometryRole: "centroid";
    exitCount: number;
    sourceUpdatedAt?: string;
  }>;
}
```

Convex ingestion uses a two-phase snapshot flow. Adapters create one `sources`
record for a fetch, upsert every valid bounded batch into staging with that
source ID, then call `amenities.finalizeSnapshot` only after all batches
succeed. Finalisation atomically publishes the staged rows and removes prior
rows that were not seen in the new snapshot. A failed adapter may call
`amenities.discardSnapshot`; either way, its older complete snapshot remains
unchanged.

Snapshot publication is capped at 5,000 rows so its worst-case publish, remove
and staging-cleanup writes remain below the current Convex transaction limit.
Denser sources need a future versioned publication strategy with bounded
chunks. Do not raise this cap and rely on one transaction.

Source pages for the approved candidates:

- `https://data.gov.sg/datasets/d_4a086da0a5553be1d89383cd90d07ecd/view`
- `https://data.gov.sg/datasets/d_b39d3a0871985372d7e1637193335da5/view`
- `https://data.gov.sg/datasets/d_cac2c32f01960a3ad7202a99c27268a0/view`
- `https://data.gov.sg/datasets/d_688b934f82c1059ed0a6993d2a829089/view`
- `https://data.gov.sg/datasets/d_696c994c50745b079b3684f0e90ffc53/view`
- `https://data.gov.sg/datasets/d_a69ef89737379f231d2ae93fd1c5707f/view`
- `https://data.gov.sg/datasets/d_9b87bab59d036a60fad2a91530e10773/view`
- `https://data.gov.sg/datasets/d_9de02d3fb33d96da1855f4fbef549a0f/view`
- `https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html`

### Production-safe primary-school snapshot

`public/data/amenities/primary-schools.json` combines two official sources.
MOE dataset `d_688b934f82c1059ed0a6993d2a829089` supplies the current School
Directory names, levels, addresses and postal codes. SLA OneMap Search supplies
the map coordinates. The 4 Aug 2026 snapshot contains all 182 eligible rows:
179 primary schools and three mixed-level schools that cover P1 to S4.

The generator normalises numeric postal values to six digits before matching.
It first requires OneMap results with the same postal code. Multiple points are
centroided only when every point retains that exact tie and the furthest pair
is no more than 350 metres apart. Address-search fallback results must match the
MOE postal code, school name or sufficiently specific address and pass the same
campus-spread check. Unmatched or wider result sets are counted separately as
missing or ambiguous. The script fails if fewer than 95 per cent of eligible
MOE rows are geocoded, so a substantially partial layer cannot be published.

Every school marker is labelled `approximate` with the role `site`. It is a
map aid, not an official home-school-distance measurement. The UI must not draw
an eligibility radius or imply Primary 1 registration eligibility from these
coordinates.

Refresh using locally configured OneMap credentials. Tokens, email addresses
and passwords are never written to the snapshot or command output:

```bash
node scripts/sync-primary-schools.mjs \
  --retrieved-at 2026-08-04T01:20:00Z
```

The output records MOE and SLA as separate provenance sources, includes source
and geocoder retrieval times, sorts by six-digit postal code, and reports
invalid identities, invalid addresses, missing geocodes and ambiguous
geocodes. Each item includes `matchedPointCount` so a reviewer can distinguish
a single OneMap point from a bounded campus centroid.

### Production-safe parks snapshot

`public/data/amenities/parks.json` uses NParks Parks and Nature Reserves dataset
`d_77d7ec97be83d44f61b85454f844382f`. The 4 Aug 2026 snapshot contains all 461
official Polygon and MultiPolygon records. Its latest valid record update is
derived from the source features and stored as `sourceLastUpdatedAt`, rather
than copied from a manually maintained catalogue note.

The map currently represents each managed-area polygon with an area-weighted
centroid. Holes are subtracted and MultiPolygon components are weighted by
their area. Each point is therefore marked `approximate` with the role
`centroid`. It is not a park entrance and should not support precise walking
distance claims. Park connectors remain unavailable because converting a line
into one point would misrepresent its access and extent.

```bash
node scripts/sync-parks.mjs \
  --retrieved-at 2026-08-04T01:18:00Z
```

The generator requires official feature IDs and names, validates representative
coordinates against Singapore bounds, sorts by NParks `OBJECTID_1`, and reports
invalid identities and geometries. The untouched official name is retained
beside a carefully title-cased display name.

### Supermarket location blocker

No supermarket switch is published. On 4 Aug 2026, both former official SFA
location dataset IDs returned `DATASET_DOES_NOT_EXIST` from data.gov.sg's
current download API:

- GeoJSON `d_cac2c32f01960a3ad7202a99c27268a0`
- KML `d_8a77ee0446716b2ce475a587004afc73`

The official Supermarkets collection 1451 also returned an empty
`childDatasets` list. A stale 2016 licence-address CSV is not a substitute for
a current SFA location dataset and would still require geocoding. Keep the
layer unavailable until SFA republishes a retrievable authoritative source.

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
