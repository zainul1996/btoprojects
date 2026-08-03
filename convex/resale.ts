import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Town-level resale statistics for the planner's getResaleMedian tool and
 * town overviews. Read-only; powered by the incremental data.gov.sg resale
 * ingestion (see convex/ingest/resale.ts).
 */

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/** Nearest-rank percentile on an ascending array. */
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[rank]!;
}

/** "YYYY-MM" minus n months, still "YYYY-MM". */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export const townMedian = query({
  args: {
    town: v.string(),
    flatType: v.optional(v.string()),
    monthsBack: v.optional(v.number()),
    // Client passes current month ("YYYY-MM"); queries must not call Date.now().
    asOfMonth: v.string(),
  },
  returns: v.object({
    town: v.string(),
    flatType: v.union(v.string(), v.null()),
    monthsBack: v.number(),
    count: v.number(),
    median: v.union(v.number(), v.null()),
    p25: v.union(v.number(), v.null()),
    p75: v.union(v.number(), v.null()),
    min: v.union(v.number(), v.null()),
    max: v.union(v.number(), v.null()),
    latestMonth: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const monthsBack = Math.min(36, Math.max(3, Math.round(args.monthsBack ?? 12)));
    const cutoff = shiftMonth(args.asOfMonth, -monthsBack);

    const rows = await ctx.db
      .query("resaleTransactions")
      .withIndex("by_town", (q) => q.eq("town", args.town))
      .collect();

    const filtered = rows.filter(
      (row) =>
        row.month >= cutoff &&
        (args.flatType === undefined || row.flatType === args.flatType),
    );
    const prices = filtered.map((row) => row.resalePrice).sort((a, b) => a - b);

    return {
      town: args.town,
      flatType: args.flatType ?? null,
      monthsBack,
      count: filtered.length,
      median: median(prices),
      p25: percentile(prices, 25),
      p75: percentile(prices, 75),
      min: prices.length > 0 ? prices[0]! : null,
      max: prices.length > 0 ? prices[prices.length - 1]! : null,
      latestMonth:
        filtered.length > 0
          ? filtered.reduce((a, b) => (a.month > b.month ? a : b)).month
          : null,
    };
  },
});
