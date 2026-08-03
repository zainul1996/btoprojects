import { v } from "convex/values";
import { authedMutation, authedQuery } from "./lib/auth";
import { normalizeProfileInput } from "./lib/profilePreferences";
import { geoPointValidator, userProfileValidator } from "./lib/validators";

export const get = authedQuery({
  args: {},
  returns: v.union(userProfileValidator, v.null()),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!profile) return null;
    return {
      _id: profile._id,
      _creationTime: profile._creationTime,
      userId: profile.userId,
      budgetMax: profile.budgetMax,
      waitToleranceMonths: profile.waitToleranceMonths,
      flatTypes: profile.flatTypes,
      towns: profile.towns,
      regions: profile.regions,
      workplaces: profile.workplaces,
      parentsArea: profile.parentsArea,
      updatedAt: profile.updatedAt,
    };
  },
});

export const getPlannerSeed = authedQuery({
  args: {},
  returns: v.union(
    v.object({
      budgetMax: v.optional(v.number()),
      waitToleranceMonths: v.optional(v.number()),
      flatTypes: v.array(v.string()),
      towns: v.optional(v.array(v.string())),
      regions: v.optional(v.array(v.string())),
      workplaceCount: v.number(),
      hasParentsArea: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!profile) return null;
    return {
      budgetMax: profile.budgetMax,
      waitToleranceMonths: profile.waitToleranceMonths,
      flatTypes: profile.flatTypes,
      towns: profile.towns,
      regions: profile.regions,
      workplaceCount: profile.workplaces.length,
      hasParentsArea: profile.parentsArea !== undefined,
    };
  },
});

export const upsert = authedMutation({
  args: {
    budgetMax: v.optional(v.number()),
    waitToleranceMonths: v.optional(v.number()),
    flatTypes: v.array(v.string()),
    towns: v.optional(v.array(v.string())),
    regions: v.optional(v.array(v.string())),
    workplaces: v.array(geoPointValidator),
    parentsArea: v.optional(geoPointValidator),
    expectedUpdatedAt: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.object({
    id: v.id("userProfiles"),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const { expectedUpdatedAt, ...profileInput } = args;
    const normalized = normalizeProfileInput(profileInput);
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (
      expectedUpdatedAt !== undefined &&
      (existing?.updatedAt ?? null) !== expectedUpdatedAt
    ) {
      throw new Error("Profile changed elsewhere");
    }

    const updatedAt = Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1);
    if (existing) {
      await ctx.db.patch("userProfiles", existing._id, {
        ...normalized,
        updatedAt,
      });
      return { id: existing._id, updatedAt };
    }
    const id = await ctx.db.insert("userProfiles", {
      userId: ctx.user._id,
      ...normalized,
      updatedAt,
    });
    return { id, updatedAt };
  },
});
