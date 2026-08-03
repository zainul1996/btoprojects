import { v } from "convex/values";
import { query } from "./_generated/server";
import { exerciseValidator } from "./lib/validators";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      exercise: exerciseValidator,
      projectCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const exercises = await ctx.db.query("exercises").collect();
    return await Promise.all(
      exercises.map(async (exercise) => ({
        exercise,
        projectCount: (
          await ctx.db
            .query("projects")
            .withIndex("by_exercise", (q) => q.eq("exerciseId", exercise._id))
            .collect()
        ).length,
      })),
    );
  },
});

export const getByKey = query({
  args: { key: v.string() },
  returns: v.union(exerciseValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exercises")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
  },
});

const sbfBoardRowValidator = v.object({
  town: v.string(),
  region: v.string(),
  projectSlug: v.string(),
  flatType: v.string(),
  units: v.number(),
  applicants: v.union(v.number(), v.null()),
  classification: v.string(),
});

/**
 * The SBF "board": one row per town x flat-type offering in an SBF exercise.
 * Supply comes from flatTypes rows (mapped types) plus verbatim facts for
 * labels outside the BTO union ("Community Care Apartment", "5-Room/3Gen",
 * "5-Room/Executive"); applicant counts come from per-row ingestion facts.
 */
export const sbfBoard = query({
  args: { exerciseKey: v.string() },
  returns: v.object({
    exercise: v.union(exerciseValidator, v.null()),
    rows: v.array(sbfBoardRowValidator),
    totals: v.object({ towns: v.number(), units: v.number() }),
  }),
  handler: async (ctx, args) => {
    const empty = { exercise: null, rows: [], totals: { towns: 0, units: 0 } };
    const exercise = await ctx.db
      .query("exercises")
      .withIndex("by_key", (q) => q.eq("key", args.exerciseKey))
      .unique();
    if (!exercise) return empty;

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", exercise._id))
      .collect();

    const rows: Array<{
      town: string;
      region: string;
      projectSlug: string;
      flatType: string;
      units: number;
      applicants: number | null;
      classification: string;
    }> = [];
    const townNames = new Set<string>();

    for (const project of projects) {
      const [town, flatTypeRows, factRows] = await Promise.all([
        ctx.db.get("towns", project.townId),
        ctx.db
          .query("flatTypes")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect(),
        ctx.db
          .query("projectFacts")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect(),
      ]);
      const townName = town?.name ?? "";
      townNames.add(townName);

      // label -> {units, applicants}; flatTypes rows are the mapped base.
      const byLabel = new Map<string, { units: number; applicants: number | null }>();
      for (const f of flatTypeRows) {
        byLabel.set(f.type, { units: f.units, applicants: null });
      }
      // Facts add applicants for mapped labels and whole rows for verbatim
      // (combined/special) labels. Field shape: flatType.<label>.<metric>.
      for (const fact of factRows) {
        const match = /^flatType\.(.+)\.(units|applicants)$/.exec(fact.field);
        if (!match) continue;
        const [, label, metric] = match;
        const value = Number(fact.value);
        if (!label || !Number.isFinite(value)) continue;
        const entry = byLabel.get(label) ?? { units: 0, applicants: null };
        if (metric === "units" && !byLabel.has(label)) entry.units = value;
        if (metric === "applicants") entry.applicants = value;
        byLabel.set(label, entry);
      }

      for (const [flatType, entry] of byLabel) {
        rows.push({
          town: townName,
          region: project.region,
          projectSlug: project.slug,
          flatType,
          units: entry.units,
          applicants: entry.applicants,
          classification: project.classification,
        });
      }
    }

    rows.sort(
      (a, b) => a.town.localeCompare(b.town) || a.flatType.localeCompare(b.flatType),
    );
    const units = rows.reduce((sum, row) => sum + row.units, 0);
    return {
      exercise,
      rows,
      totals: { towns: townNames.size, units },
    };
  },
});
