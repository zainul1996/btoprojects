import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  comparablesValidator,
  projectDetailsValidator,
  projectSummaryValidator,
  townValidator,
} from "./lib/validators";
import { classificationValidator, exerciseTypeValidator } from "./schema";

/**
 * Public, anonymous-friendly project browsing (guardrail: no auth wall).
 *
 * The dataset is small by design (12 seeded projects, bounded by the number
 * of BTO launches per year), so `list` uses the cheapest applicable index to
 * get a candidate set and then narrows the remaining filters in TypeScript.
 * That keeps the API flexible without maintaining six compound indexes for
 * combinations that scan a few dozen rows.
 */

async function attachTownAndFlatTypes(
  ctx: QueryCtx,
  project: Doc<"projects">,
) {
  const [town, flatTypes, exercise] = await Promise.all([
    ctx.db.get("towns", project.townId),
    ctx.db
      .query("flatTypes")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect(),
    ctx.db.get("exercises", project.exerciseId),
  ]);
  return { project, town, flatTypes, exerciseLabel: exercise?.label ?? null };
}

export const list = query({
  args: {
    region: v.optional(v.string()),
    town: v.optional(v.string()),
    classification: v.optional(classificationValidator),
    flatType: v.optional(v.string()),
    maxPrice: v.optional(v.number()),
    maxWaitMonths: v.optional(v.number()),
    saleType: v.optional(exerciseTypeValidator),
    search: v.optional(v.string()),
  },
  returns: v.array(projectSummaryValidator),
  handler: async (ctx, args) => {
    const { town: townName, region, classification, flatType } = args;
    const { maxPrice, maxWaitMonths } = args;
    let candidates: Doc<"projects">[];

    if (townName) {
      const town = await ctx.db
        .query("towns")
        .withIndex("by_name", (q) => q.eq("name", townName))
        .unique();
      if (!town) return [];
      candidates = await ctx.db
        .query("projects")
        .withIndex("by_town", (q) => q.eq("townId", town._id))
        .collect();
    } else if (region) {
      candidates = await ctx.db
        .query("projects")
        .withIndex("by_region", (q) => q.eq("region", region))
        .collect();
    } else if (classification) {
      candidates = await ctx.db
        .query("projects")
        .withIndex("by_classification", (q) =>
          q.eq("classification", classification),
        )
        .collect();
    } else {
      candidates = await ctx.db.query("projects").collect();
    }

    const withDetails = await Promise.all(
      candidates.map((p) => attachTownAndFlatTypes(ctx, p)),
    );

    const searchNeedle = args.search?.trim().toLowerCase();

    return withDetails.filter(({ project, town, flatTypes }) => {
      // Auto-created ingestion shells carry placeholder zeros (no supply,
      // price or completion data) until enrichment — keep them off public
      // browsing so cards never render "~0 mo wait" with no price.
      if (project.totalUnits === 0) return false;
      if (args.saleType && (project.saleType ?? "bto") !== args.saleType)
        return false;
      if (classification && project.classification !== classification)
        return false;
      if (region && project.region !== region) return false;
      if (
        maxWaitMonths !== undefined &&
        // SBF pools mix individual flats, and 0 means unknown elsewhere; neither
        // can honestly satisfy an explicit wait ceiling.
        ((project.saleType ?? "bto") === "sbf" ||
          project.estimatedWaitMonths <= 0 ||
          project.estimatedWaitMonths > maxWaitMonths)
      )
        return false;
      if (flatType && !flatTypes.some((f) => f.type === flatType))
        return false;
      // A unit of ANY flat type under the price ceiling qualifies the project.
      // SBF pools carry no prices (0 = TBC), so they can never satisfy an
      // honest price ceiling — same philosophy as announced rows and wait.
      if (
        maxPrice !== undefined &&
        ((project.saleType ?? "bto") === "sbf" ||
          !flatTypes.some((f) => f.minPrice <= maxPrice))
      )
        return false;
      if (searchNeedle) {
        const haystack = [project.name, project.description, town?.name ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchNeedle)) return false;
      }
      return true;
    });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(projectDetailsValidator, v.null()),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!project) return null;

    const [town, exercise, flatTypes, factRows, sourceLinks] = await Promise.all([
      ctx.db.get("towns", project.townId),
      ctx.db.get("exercises", project.exerciseId),
      ctx.db
        .query("flatTypes")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("projectFacts")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("projectSources")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect(),
    ]);

    const facts: Record<string, Doc<"projectFacts">[]> = {};
    for (const fact of factRows) {
      (facts[fact.field] ??= []).push(fact);
    }

    const sourceIds = new Set([
      ...sourceLinks.map((link) => link.sourceId),
      ...factRows.flatMap((fact) => (fact.sourceId ? [fact.sourceId] : [])),
    ]);
    const sources = (
      await Promise.all(
        [...sourceIds].map((sourceId) => ctx.db.get("sources", sourceId)),
      )
    ).filter((source): source is Doc<"sources"> => source !== null);

    return { project, town, exercise, flatTypes, facts, sources };
  },
});

export const listByExercise = query({
  args: { exerciseKey: v.string() },
  returns: v.array(projectSummaryValidator),
  handler: async (ctx, args) => {
    const exercise = await ctx.db
      .query("exercises")
      .withIndex("by_key", (q) => q.eq("key", args.exerciseKey))
      .unique();
    if (!exercise) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", exercise._id))
      .collect();
    return await Promise.all(
      projects.map((p) => attachTownAndFlatTypes(ctx, p)),
    );
  },
});

export const listByTown = query({
  args: { townName: v.string() },
  returns: v.object({
    town: v.union(townValidator, v.null()),
    projects: v.array(projectSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const town = await ctx.db
      .query("towns")
      .withIndex("by_name", (q) => q.eq("name", args.townName))
      .unique();
    if (!town) return { town: null, projects: [] };
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_town", (q) => q.eq("townId", town._id))
      .collect();
    return {
      town,
      projects: await Promise.all(
        projects.map((p) => attachTownAndFlatTypes(ctx, p)),
      ),
    };
  },
});

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** BTO labels at the project boundary → canonical data.gov.sg resale labels. */
function toResaleFlatType(flatType: string): string {
  if (flatType === "2-room Flexi") return "2-room";
  if (flatType === "3Gen") return "multi-generation";
  return flatType;
}

/** "YYYY-MM" minus n months, still "YYYY-MM". */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export const comparables = query({
  args: {
    projectId: v.id("projects"),
    flatTypes: v.optional(v.array(v.string())),
    // Client passes current month ("YYYY-MM"); queries must not call Date.now().
    asOfMonth: v.string(),
  },
  returns: comparablesValidator,
  handler: async (ctx, args) => {
    const project = await ctx.db.get("projects", args.projectId);
    if (!project) {
      return {
        transactions: [],
        median: null,
        count: 0,
        recentMedian: null,
        recentCount: 0,
      };
    }
    const town = await ctx.db.get("towns", project.townId);
    if (!town) {
      return {
        transactions: [],
        median: null,
        count: 0,
        recentMedian: null,
        recentCount: 0,
      };
    }

    const wantedTypes = args.flatTypes?.length
      ? [...new Set(args.flatTypes.map(toResaleFlatType))]
      : null;
    const filtered = wantedTypes
      ? (
          await Promise.all(
            wantedTypes.map((flatType) =>
              ctx.db
                .query("resaleTransactions")
                .withIndex("by_town_and_type", (q) =>
                  q.eq("town", town.name).eq("flatType", flatType),
                )
                .collect(),
            ),
          )
        ).flat()
      : await ctx.db
          .query("resaleTransactions")
          .withIndex("by_town", (q) => q.eq("town", town.name))
          .collect();

    const cutoff = shiftMonth(args.asOfMonth, -6);
    const recent = filtered.filter((r) => r.month >= cutoff);

    const latestFirst = [...filtered].sort((a, b) =>
      b.month.localeCompare(a.month),
    );

    return {
      transactions: latestFirst.slice(0, 50),
      median: median(filtered.map((r) => r.resalePrice)),
      count: filtered.length,
      recentMedian: median(recent.map((r) => r.resalePrice)),
      recentCount: recent.length,
    };
  },
});
