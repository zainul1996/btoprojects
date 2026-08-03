import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
  confidenceValidator,
  extractionMethodValidator,
  sourceKindValidator,
} from "../schema";

/**
 * Ingestion framework core. Every crawler funnels writes through these
 * mutations so provenance (sources rows), change history (projectFacts rows)
 * and run observability (ingestionJobs rows) are consistent across sources.
 *
 * Guardrail: a fact already marked confidence "official" is never downgraded
 * by a lower-confidence source — the incoming value is dropped and the run
 * counts a conflict instead.
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
      finishedAt: Date.now(),
      status: args.status,
      ...(args.stats !== undefined ? { stats: args.stats } : {}),
      ...(args.error !== undefined ? { error: args.error } : {}),
    });
    return null;
  },
});

/** One sources row per fetch — that row IS the retrieval provenance. */
export const upsertSource = internalMutation({
  args: {
    url: v.string(),
    kind: sourceKindValidator,
    publisher: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.id("sources"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("sources", {
      url: args.url,
      kind: args.kind,
      publisher: args.publisher,
      retrievedAt: Date.now(),
      ...(args.title !== undefined ? { title: args.title } : {}),
    });
  },
});

export const applyProjectFact = internalMutation({
  args: {
    projectId: v.id("projects"),
    field: v.string(),
    value: v.string(),
    confidence: confidenceValidator,
    extractionMethod: extractionMethodValidator,
    sourceId: v.optional(v.id("sources")),
    effectiveDate: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.union(
    v.literal("inserted"),
    v.literal("unchanged"),
    v.literal("conflict"),
  ),
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("projectFacts")
      .withIndex("by_project_and_field", (q) =>
        q.eq("projectId", args.projectId).eq("field", args.field),
      )
      .order("desc")
      .first();

    if (latest && latest.value === args.value) return "unchanged";
    if (
      latest &&
      latest.confidence === "official" &&
      args.confidence !== "official"
    ) {
      return "conflict";
    }

    await ctx.db.insert("projectFacts", {
      projectId: args.projectId,
      field: args.field,
      value: args.value,
      confidence: args.confidence,
      extractionMethod: args.extractionMethod,
      retrievedAt: Date.now(),
      ...(args.sourceId !== undefined ? { sourceId: args.sourceId } : {}),
      ...(args.effectiveDate !== undefined
        ? { effectiveDate: args.effectiveDate }
        : {}),
      ...(args.note !== undefined ? { note: args.note } : {}),
    });
    return latest ? "conflict" : "inserted";
  },
});

/** kv helpers for incremental cursors (e.g. latest resale month ingested). */
export const getKv = internalMutation({
  args: { key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("kv")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return row?.value ?? null;
  },
});

export const setKv = internalMutation({
  args: { key: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("kv")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch("kv", existing._id, { value: args.value });
    } else {
      await ctx.db.insert("kv", { key: args.key, value: args.value });
    }
    return null;
  },
});

export type ApplyFactResult = "inserted" | "unchanged" | "conflict";
