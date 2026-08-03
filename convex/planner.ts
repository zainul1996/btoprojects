import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/auth";
import { lifecycleStatusValidator } from "./schema";

const rankableFlatTypeValidator = v.object({
  type: v.string(),
  units: v.number(),
  minPrice: v.number(),
  maxPrice: v.number(),
});

const rankableProjectValidator = v.object({
  slug: v.string(),
  name: v.string(),
  town: v.string(),
  region: v.string(),
  classification: v.union(
    v.literal("Standard"),
    v.literal("Plus"),
    v.literal("Prime"),
  ),
  lifecycleStatus: lifecycleStatusValidator,
  estimatedWaitMonths: v.number(),
  estimatedCompletion: v.string(),
  applicationDeadline: v.optional(v.string()),
  exerciseLabel: v.optional(v.string()),
  mrtWalkingMinutes: v.number(),
  nearestMrt: v.array(v.string()),
  totalUnits: v.number(),
  lat: v.number(),
  lng: v.number(),
  flatTypes: v.array(rankableFlatTypeValidator),
  // Record freshness: the chat route derives dataAsOf from the max of these.
  updatedAt: v.number(),
});

const plannerMessageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  citedProjectSlugs: v.optional(v.array(v.string())),
  constraints: v.optional(v.any()),
});

const plannerSessionValidator = v.object({
  _id: v.id("plannerSessions"),
  _creationTime: v.number(),
  userId: v.id("users"),
  messages: v.array(plannerMessageValidator),
  constraints: v.optional(v.any()),
  updatedAt: v.number(),
});

// Keep stored transcripts bounded; older turns stay in client memory only.
const MAX_STORED_MESSAGES = 40;

export const listSessions = authedQuery({
  args: {},
  returns: v.array(plannerSessionValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("plannerSessions")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
  },
});

export const getSession = authedQuery({
  args: { sessionId: v.id("plannerSessions") },
  returns: v.union(plannerSessionValidator, v.null()),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("plannerSessions", args.sessionId);
    if (!session) return null;
    if (session.userId !== ctx.user._id) throw new Error("Unauthorized");
    return session;
  },
});

export const clearSession = authedMutation({
  args: { sessionId: v.id("plannerSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("plannerSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== ctx.user._id) throw new Error("Unauthorized");
    await ctx.db.patch("plannerSessions", args.sessionId, {
      messages: [],
      constraints: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * All projects joined with town name + flat types, shaped for the pure
 * rankProjects() function. Called from plannerActions via ctx.runQuery.
 */
export const allForRanking = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Exclude ingestion shells (totalUnits 0 placeholder) and announced-only
    // projects (no prices yet — budget scoring would mislead). Announced
    // projects return to rankings the day launch data lands.
    const projects = (await ctx.db.query("projects").collect()).filter(
      (project) =>
        project.totalUnits > 0 && project.lifecycleStatus !== "announced",
    );
    return await Promise.all(
      projects.map(async (project) => {
        const [town, exercise, flatTypes] = await Promise.all([
          ctx.db.get("towns", project.townId),
          ctx.db.get("exercises", project.exerciseId),
          ctx.db
            .query("flatTypes")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
        ]);
        return {
          slug: project.slug,
          name: project.name,
          town: town?.name ?? "",
          region: project.region,
          classification: project.classification,
          lifecycleStatus: project.lifecycleStatus,
          estimatedWaitMonths: project.estimatedWaitMonths,
          estimatedCompletion: project.estimatedCompletion,
          applicationDeadline: project.applicationDeadline,
          exerciseLabel: exercise?.label,
          mrtWalkingMinutes: project.mrtWalkingMinutes,
          nearestMrt: project.nearestMrt,
          totalUnits: project.totalUnits,
          lat: project.lat,
          lng: project.lng,
          flatTypes: flatTypes.map((f) => ({
            type: f.type,
            units: f.units,
            minPrice: f.minPrice,
            maxPrice: f.maxPrice,
          })),
          updatedAt: project.updatedAt,
        };
      }),
    );
  },
});

/**
 * Public twin of allForRanking: project data is public (no auth wall), and
 * the streaming chat route handler reads it through ConvexHttpClient.
 */
export const forRanking = query({
  args: {},
  returns: v.array(rankableProjectValidator),
  handler: async (ctx) => {
    // Same exclusions as allForRanking: placeholder shells (totalUnits 0)
    // and announced-only projects (no prices to rank on).
    const projects = (await ctx.db.query("projects").collect()).filter(
      (project) =>
        project.totalUnits > 0 && project.lifecycleStatus !== "announced",
    );
    return await Promise.all(
      projects.map(async (project) => {
        const [town, exercise, flatTypes] = await Promise.all([
          ctx.db.get("towns", project.townId),
          ctx.db.get("exercises", project.exerciseId),
          ctx.db
            .query("flatTypes")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
        ]);
        return {
          slug: project.slug,
          name: project.name,
          town: town?.name ?? "",
          region: project.region,
          classification: project.classification,
          lifecycleStatus: project.lifecycleStatus,
          estimatedWaitMonths: project.estimatedWaitMonths,
          estimatedCompletion: project.estimatedCompletion,
          applicationDeadline: project.applicationDeadline,
          exerciseLabel: exercise?.label,
          mrtWalkingMinutes: project.mrtWalkingMinutes,
          nearestMrt: project.nearestMrt,
          totalUnits: project.totalUnits,
          lat: project.lat,
          lng: project.lng,
          flatTypes: flatTypes.map((f) => ({
            type: f.type,
            units: f.units,
            minPrice: f.minPrice,
            maxPrice: f.maxPrice,
          })),
          updatedAt: project.updatedAt,
        };
      }),
    );
  },
});

/**
 * Client-side persistence for the streaming planner: after a reply finishes
 * streaming, the chat UI saves the turn here (same storage as persistTurn).
 */
export const saveTurn = authedMutation({
  args: {
    sessionId: v.optional(v.id("plannerSessions")),
    userMessage: v.string(),
    assistantMessage: v.string(),
    constraints: v.optional(v.any()),
    citedProjectSlugs: v.array(v.string()),
  },
  returns: v.id("plannerSessions"),
  handler: async (ctx, args) => {
    const newMessages: Doc<"plannerSessions">["messages"] = [
      { role: "user", content: args.userMessage },
      {
        role: "assistant",
        content: args.assistantMessage,
        citedProjectSlugs: args.citedProjectSlugs,
        constraints: args.constraints,
      },
    ];

    const existing = args.sessionId
      ? await ctx.db.get("plannerSessions", args.sessionId)
      : undefined;
    if (existing) {
      if (existing.userId !== ctx.user._id) throw new Error("Unauthorized");
      const merged = [...existing.messages, ...newMessages].slice(
        -MAX_STORED_MESSAGES,
      );
      await ctx.db.patch("plannerSessions", existing._id, {
        messages: merged,
        constraints: args.constraints ?? existing.constraints,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("plannerSessions", {
      userId: ctx.user._id,
      messages: newMessages,
      constraints: args.constraints,
      updatedAt: Date.now(),
    });
  },
});

export const persistTurn = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.optional(v.id("plannerSessions")),
    userMessage: v.string(),
    assistantMessage: v.string(),
    constraints: v.optional(v.any()),
    citedProjectSlugs: v.array(v.string()),
  },
  returns: v.id("plannerSessions"),
  handler: async (ctx, args) => {
    const newMessages: Doc<"plannerSessions">["messages"] = [
      { role: "user", content: args.userMessage },
      {
        role: "assistant",
        content: args.assistantMessage,
        citedProjectSlugs: args.citedProjectSlugs,
        constraints: args.constraints,
      },
    ];

    const existing = args.sessionId
      ? await ctx.db.get("plannerSessions", args.sessionId)
      : undefined;
    if (existing) {
      if (existing.userId !== args.userId) throw new Error("Unauthorized");
      const merged = [...existing.messages, ...newMessages].slice(
        -MAX_STORED_MESSAGES,
      );
      await ctx.db.patch("plannerSessions", existing._id, {
        messages: merged,
        constraints: args.constraints ?? existing.constraints,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("plannerSessions", {
      userId: args.userId,
      messages: newMessages,
      constraints: args.constraints,
      updatedAt: Date.now(),
    });
  },
});