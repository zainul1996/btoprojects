import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { seedMrtStations, seedProjects, seedTowns, type SeedProject } from "./seedData";

/**
 * Idempotent seed: upserts by natural keys (exercise key, town name, station
 * code, project slug) so re-runs converge instead of duplicating. Child rows
 * (flatTypes, projectFacts) are replaced wholesale per project — their ids
 * are not referenced elsewhere, and replacement keeps provenance exactly in
 * sync with the seed notes.
 *
 * Confidence policy (per seed notes): unit counts / prices / wait times come
 * from publisher tables of HDB launch data → "official"; computed completion
 * months, approximate coordinates and walking minutes → "estimated".
 */

const OFFICIAL_DOMAINS = new Set(["hdb.gov.sg", "mynicehome.gov.sg"]);

function sourceKindFor(url: string): "hdb" | "publisher" {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  return OFFICIAL_DOMAINS.has(hostname) ? "hdb" : "publisher";
}

function publisherFor(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

async function upsertSource(
  ctx: MutationCtx,
  url: string,
  retrievedAt: number,
): Promise<Id<"sources">> {
  const existing = await ctx.db
    .query("sources")
    .withIndex("by_url", (q) => q.eq("url", url))
    .unique();
  if (existing) {
    await ctx.db.patch("sources", existing._id, { retrievedAt });
    return existing._id;
  }
  return await ctx.db.insert("sources", {
    url,
    publisher: publisherFor(url),
    kind: sourceKindFor(url),
    retrievedAt,
  });
}

async function replaceFlatTypes(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  flatTypes: SeedProject["flatTypes"],
): Promise<number> {
  const existing = await ctx.db
    .query("flatTypes")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  await Promise.all(existing.map((row) => ctx.db.delete("flatTypes", row._id)));
  for (const flat of flatTypes) {
    await ctx.db.insert("flatTypes", { projectId, ...flat });
  }
  return flatTypes.length;
}

interface FactInput {
  field: string;
  value: string;
  confidence: "official" | "estimated";
}

async function replaceFacts(
  ctx: MutationCtx,
  project: Doc<"projects">,
  flatTypes: SeedProject["flatTypes"],
  sourceId: Id<"sources"> | undefined,
  retrievedAt: number,
): Promise<number> {
  const existing = await ctx.db
    .query("projectFacts")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .collect();
  await Promise.all(existing.map((row) => ctx.db.delete("projectFacts", row._id)));

  const facts: FactInput[] = [
    { field: "classification", value: project.classification, confidence: "official" },
    { field: "region", value: project.region, confidence: "official" },
    { field: "totalUnits", value: String(project.totalUnits), confidence: "official" },
    {
      field: "estimatedWaitMonths",
      value: String(project.estimatedWaitMonths),
      confidence: "official",
    },
    {
      field: "estimatedCompletion",
      value: project.estimatedCompletion,
      confidence: "estimated",
    },
    { field: "nearestMrt", value: project.nearestMrt.join("; "), confidence: "estimated" },
    {
      field: "mrtWalkingMinutes",
      value: String(project.mrtWalkingMinutes),
      confidence: "estimated",
    },
    { field: "lat", value: String(project.lat), confidence: "estimated" },
    { field: "lng", value: String(project.lng), confidence: "estimated" },
  ];
  if (project.applicationDeadline) {
    facts.push({
      field: "applicationDeadline",
      value: project.applicationDeadline,
      confidence: "official",
    });
  }
  for (const flat of flatTypes) {
    facts.push(
      {
        field: `flatType.${flat.type}.units`,
        value: String(flat.units),
        confidence: "official",
      },
      {
        field: `flatType.${flat.type}.minPrice`,
        value: String(flat.minPrice),
        confidence: "official",
      },
      {
        field: `flatType.${flat.type}.maxPrice`,
        value: String(flat.maxPrice),
        confidence: "official",
      },
    );
  }

  for (const fact of facts) {
    await ctx.db.insert("projectFacts", {
      projectId: project._id,
      field: fact.field,
      value: fact.value,
      confidence: fact.confidence,
      extractionMethod: "research",
      sourceId,
      retrievedAt,
    });
  }
  return facts.length;
}

export const run = internalMutation({
  args: {},
  returns: v.object({
    exercises: v.number(),
    towns: v.number(),
    mrtStations: v.number(),
    projects: v.number(),
    flatTypes: v.number(),
    sources: v.number(),
    projectSources: v.number(),
    projectFacts: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const stats = {
      exercises: 0,
      towns: 0,
      mrtStations: 0,
      projects: 0,
      flatTypes: 0,
      sources: 0,
      projectSources: 0,
      projectFacts: 0,
    };

    // 1. Exercises (both BTO, both closed — applications have ended).
    const exerciseIdByKey = new Map<string, Id<"exercises">>();
    const exerciseDefs = new Map<
      string,
      { label: string; applicationEnd?: string }
    >();
    for (const project of seedProjects) {
      const def = exerciseDefs.get(project.exercise) ?? {
        label: project.exerciseLabel,
      };
      if (project.applicationDeadline) def.applicationEnd = project.applicationDeadline;
      exerciseDefs.set(project.exercise, def);
    }
    for (const [key, def] of exerciseDefs) {
      const existing = await ctx.db
        .query("exercises")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      const fields = {
        label: def.label,
        type: "bto" as const,
        status: "closed" as const,
        applicationEnd: def.applicationEnd,
      };
      if (existing) {
        await ctx.db.patch("exercises", existing._id, fields);
        exerciseIdByKey.set(key, existing._id);
      } else {
        exerciseIdByKey.set(key, await ctx.db.insert("exercises", { key, ...fields }));
      }
      stats.exercises++;
    }

    // 2. Towns.
    const townIdByName = new Map<string, Id<"towns">>();
    for (const town of seedTowns) {
      const existing = await ctx.db
        .query("towns")
        .withIndex("by_name", (q) => q.eq("name", town.name))
        .unique();
      if (existing) {
        await ctx.db.patch("towns", existing._id, town);
        townIdByName.set(town.name, existing._id);
      } else {
        townIdByName.set(town.name, await ctx.db.insert("towns", town));
      }
      stats.towns++;
    }

    // 3. MRT stations.
    for (const station of seedMrtStations) {
      const existing = await ctx.db
        .query("mrtStations")
        .withIndex("by_code", (q) => q.eq("code", station.code))
        .unique();
      if (existing) {
        await ctx.db.patch("mrtStations", existing._id, station);
      } else {
        await ctx.db.insert("mrtStations", station);
      }
      stats.mrtStations++;
    }

    // 4. Sources (one row per unique URL across all projects).
    const sourceIdByUrl = new Map<string, Id<"sources">>();
    for (const project of seedProjects) {
      for (const url of project.sourceUrls) {
        if (!sourceIdByUrl.has(url)) {
          sourceIdByUrl.set(url, await upsertSource(ctx, url, now));
          stats.sources++;
        }
      }
    }

    // 5. Projects + flatTypes + provenance.
    for (const seed of seedProjects) {
      const townId = townIdByName.get(seed.town);
      const exerciseId = exerciseIdByKey.get(seed.exercise);
      if (!townId || !exerciseId) {
        throw new Error(`Seed referential error for project ${seed.slug}`);
      }

      const fields = {
        name: seed.name,
        townId,
        exerciseId,
        region: seed.region,
        classification: seed.classification,
        lifecycleStatus: seed.lifecycleStatus,
        lat: seed.lat,
        lng: seed.lng,
        description: seed.description,
        totalUnits: seed.totalUnits,
        estimatedWaitMonths: seed.estimatedWaitMonths,
        estimatedCompletion: seed.estimatedCompletion,
        nearestMrt: seed.nearestMrt,
        mrtWalkingMinutes: seed.mrtWalkingMinutes,
        applicationDeadline: seed.applicationDeadline,
        notes: seed.notes,
        updatedAt: now,
      };

      const existing = await ctx.db
        .query("projects")
        .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
        .unique();
      let project: Doc<"projects">;
      if (existing) {
        await ctx.db.patch("projects", existing._id, fields);
        project = { ...existing, ...fields };
      } else {
        const id = await ctx.db.insert("projects", { slug: seed.slug, ...fields });
        const inserted = await ctx.db.get("projects", id);
        if (!inserted) throw new Error(`Failed to insert project ${seed.slug}`);
        project = inserted;
      }
      stats.projects++;

      stats.flatTypes += await replaceFlatTypes(ctx, project._id, seed.flatTypes);

      // projectSources links (deduped).
      const linked = await ctx.db
        .query("projectSources")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      const linkedSourceIds = new Set(linked.map((l) => l.sourceId));
      let primarySourceId: Id<"sources"> | undefined;
      for (const url of seed.sourceUrls) {
        const sourceId = sourceIdByUrl.get(url);
        if (!sourceId) continue;
        if (!primarySourceId) primarySourceId = sourceId;
        if (!linkedSourceIds.has(sourceId)) {
          await ctx.db.insert("projectSources", {
            projectId: project._id,
            sourceId,
          });
          stats.projectSources++;
        }
      }

      stats.projectFacts += await replaceFacts(
        ctx,
        project,
        seed.flatTypes,
        primarySourceId,
        now,
      );
    }

    return stats;
  },
});
