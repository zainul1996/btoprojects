import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Ingestion schedule (times in UTC; SGT = UTC+8). All crons are off-peak
 * and staggered per @convex-dev/no-top-of-hour-crons.
 *
 * Resale / geocode / launch crawls run through the new ingestion pipeline
 * (convex/ingest/*): each run writes retrieval provenance (sources), change
 * history (projectFacts) and run stats (ingestionJobs) via the shared
 * framework in convex/ingest/lib.ts. The legacy datagov.syncResale action is
 * superseded by ingest/resale.ts (full-dataset incremental, not seed-town
 * sampling).
 */
const crons = cronJobs();

// 03:07 SGT on the 10th and 20th — resale comparables refresh. The dataset
// updates monthly on a floating release day, and the data is inherently
// registration-lagged, so twice-monthly keeps comparables fresh enough
// without daily 22MB CSV downloads. Incremental: the newest stored month
// is always re-ingested for late registrations.
crons.cron(
  "datagov resale sync",
  "7 19 10,20 * *",
  internal.ingest.resale.run,
  {},
);

// 04:11 SGT — OneMap geocode pass: fill missing project coordinates and
// catch drift (fresh projects are skipped without API calls).
crons.cron("onemap geocode ingest", "11 20 * * *", internal.ingest.onemap.run, {});

// 02:23 SGT — HDB launch ingestion: exercises, new-project shells and
// official facts from the Flat Portal application-rate files.
crons.cron("hdb launch ingest", "23 18 * * *", internal.ingest.hdb.run, {});

// 02:30 SGT — keep the OneMap token warm (72h TTL, 12h refresh margin).
crons.cron("onemap token refresh", "30 18 * * *", internal.onemap.getToken, {});

export default crons;
