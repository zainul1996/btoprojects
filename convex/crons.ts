import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Daily ingestion schedule (times in UTC; SGT = UTC+8).
 *
 * No HDB page cron yet: launch data is snapshot/research-seeded per the
 * seed-first decision — HDB fetch+parse ingestion lands with the parser
 * pipeline (snapshot → parse → reconcile), not in the MVP seed phase.
 */
const crons = cronJobs();

// 03:07 SGT — resale comparables refresh for the seed towns (off the
// top-of-hour peak per @convex-dev/no-top-of-hour-crons).
crons.cron("datagov resale sync", "7 19 * * *", internal.datagov.syncResale, {});

// 02:30 SGT — keep the OneMap token warm (72h TTL, 12h refresh margin).
crons.cron("onemap token refresh", "30 18 * * *", internal.onemap.getToken, {});

export default crons;
