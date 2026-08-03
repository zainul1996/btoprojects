import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-off SBF setup (Aug 2026):
 *  1. towns row for HDB's verbatim "Jurong East/ West" SBF lumping.
 *  2. Expected-next exercise row ("2027-02-sbf", status upcoming) so the
 *     /upcoming page and the planner calendar can talk about the next SBF
 *     before composition is revealed (annual February cadence since 2024;
 *     composition only lands on launch day).
 *  3. saleType backfill: rows predating the field read as "bto" everywhere,
 *     but we write it explicitly to keep downstream queries honest.
 *
 * Idempotent. Run: npx convex run seedSbf:run
 */
export const run = internalMutation({
  args: {},
  returns: v.object({
    townsEnsured: v.number(),
    exerciseId: v.id("exercises"),
    exerciseCreated: v.boolean(),
    saleTypeBackfilled: v.number(),
  }),
  handler: async (ctx) => {
    let townsEnsured = 0;
    const jurongLump = await ctx.db
      .query("towns")
      .withIndex("by_name", (q) => q.eq("name", "Jurong East/ West"))
      .unique();
    if (!jurongLump) {
      // HDB lumps the two towns in SBF files; midpoint of the seeded
      // Jurong East (1.3331, 103.742) and Jurong West (1.3404, 103.709).
      await ctx.db.insert("towns", {
        name: "Jurong East/ West",
        region: "West",
        lat: 1.3368,
        lng: 103.7255,
      });
      townsEnsured++;
    }

    const existingExercise = await ctx.db
      .query("exercises")
      .withIndex("by_key", (q) => q.eq("key", "2027-02-sbf"))
      .unique();
    let exerciseId = existingExercise?._id;
    if (!exerciseId) {
      exerciseId = await ctx.db.insert("exercises", {
        key: "2027-02-sbf",
        label: "February 2027 SBF",
        type: "sbf",
        status: "upcoming",
      });
    }

    let saleTypeBackfilled = 0;
    const projects = await ctx.db.query("projects").collect();
    for (const project of projects) {
      if (project.saleType === undefined) {
        await ctx.db.patch("projects", project._id, { saleType: "bto" });
        saleTypeBackfilled++;
      }
    }

    return {
      townsEnsured,
      exerciseId,
      exerciseCreated: !existingExercise,
      saleTypeBackfilled,
    };
  },
});

/**
 * Display-name cleanup (Aug 2026, post-launch UX review): SBF pool names
 * launched as "{Town} balance flats ({exercise label})" — type and exercise
 * context stuffed into the identity field. Names are now just
 * "{Town} balance flats"; the SBF badge and exercise chip carry the rest.
 * Slugs are untouched (stable URLs). Idempotent.
 * Run: npx convex run seedSbf:renamePools
 */
export const renamePools = internalMutation({
  args: {},
  returns: v.object({ renamed: v.number() }),
  handler: async (ctx) => {
    let renamed = 0;
    const pools = (await ctx.db.query("projects").collect()).filter(
      (project) => project.saleType === "sbf",
    );
    for (const pool of pools) {
      const town = await ctx.db.get("towns", pool.townId);
      if (!town) continue;
      const wanted = `${town.name} balance flats`;
      if (pool.name !== wanted) {
        await ctx.db.patch("projects", pool._id, {
          name: wanted,
          updatedAt: Date.now(),
        });
        renamed++;
      }
    }
    return { renamed };
  },
});
