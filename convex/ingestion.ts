import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Internal mutations backing the "use node" data.gov.sg adapter actions
 * (which cannot touch the db directly). Job lifecycle + deduped storage.
 */

export const startJob = internalMutation({
  args: { source: v.string() },
  returns: v.id("ingestionJobs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("ingestionJobs", {
      source: args.source,
      status: "running",
      startedAt: Date.now(),
    });
  },
});

export const finishJob = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    status: v.union(v.literal("success"), v.literal("failed")),
    stats: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("ingestionJobs", args.jobId, {
      status: args.status,
      finishedAt: Date.now(),
      stats: args.stats,
      error: args.error,
    });
    return null;
  },
});

export const storeResale = internalMutation({
  args: {
    records: v.array(
      v.object({
        town: v.string(),
        flatType: v.string(),
        block: v.string(),
        streetName: v.string(),
        storeyRange: v.string(),
        floorAreaSqm: v.number(),
        flatModel: v.string(),
        leaseCommenceDate: v.number(),
        resalePrice: v.number(),
        month: v.string(),
      }),
    ),
  },
  returns: v.object({ inserted: v.number(), skippedDuplicates: v.number() }),
  handler: async (ctx, args) => {
    // Dedupe within the affected months only (a month partition stays small
    // because we ingest just the seed towns).
    const months = [...new Set(args.records.map((r) => r.month))];
    const existingKeys = new Set<string>();
    for (const month of months) {
      const rows = await ctx.db
        .query("resaleTransactions")
        .withIndex("by_month", (q) => q.eq("month", month))
        .collect();
      for (const row of rows) {
        existingKeys.add(
          `${row.town}|${row.block}|${row.streetName}|${row.month}|${row.flatType}|${row.resalePrice}`,
        );
      }
    }

    let inserted = 0;
    let skippedDuplicates = 0;
    for (const record of args.records) {
      const key = `${record.town}|${record.block}|${record.streetName}|${record.month}|${record.flatType}|${record.resalePrice}`;
      if (existingKeys.has(key)) {
        skippedDuplicates++;
        continue;
      }
      existingKeys.add(key);
      await ctx.db.insert("resaleTransactions", record);
      inserted++;
    }
    return { inserted, skippedDuplicates };
  },
});

export const upsertSchool = internalMutation({
  args: {
    name: v.string(),
    level: v.union(
      v.literal("primary"),
      v.literal("secondary"),
      v.literal("mixed"),
    ),
    address: v.optional(v.string()),
  },
  returns: v.object({ inserted: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) {
      await ctx.db.patch("schools", existing._id, {
        level: args.level,
        address: args.address,
      });
      return { inserted: false };
    }
    await ctx.db.insert("schools", {
      name: args.name,
      level: args.level,
      address: args.address,
    });
    return { inserted: true };
  },
});
