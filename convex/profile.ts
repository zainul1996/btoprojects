import { v } from "convex/values";
import { authedMutation, authedQuery } from "./lib/auth";
import { geoPointValidator, userProfileValidator } from "./lib/validators";

export const get = authedQuery({
  args: {},
  returns: v.union(userProfileValidator, v.null()),
  handler: async (ctx) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .unique();
  },
});

export const upsert = authedMutation({
  args: {
    budgetMax: v.optional(v.number()),
    householdType: v.optional(v.string()),
    waitToleranceMonths: v.optional(v.number()),
    flatTypes: v.array(v.string()),
    workplaces: v.array(geoPointValidator),
    parentsArea: v.optional(geoPointValidator),
  },
  returns: v.id("userProfiles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .unique();

    if (existing) {
      await ctx.db.patch("userProfiles", existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("userProfiles", {
      userId: ctx.user._id,
      ...args,
      updatedAt: Date.now(),
    });
  },
});
