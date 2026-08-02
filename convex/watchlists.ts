import { v } from "convex/values";
import { authedMutation, authedQuery } from "./lib/auth";
import { watchlistValidator } from "./lib/validators";

const targetTypeValidator = v.union(
  v.literal("project"),
  v.literal("town"),
  v.literal("mrt"),
);

export const listMine = authedQuery({
  args: {},
  returns: v.array(watchlistValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("watchlists")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
  },
});

export const isWatching = authedQuery({
  args: { targetType: targetTypeValidator, targetId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("watchlists")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId),
      )
      .collect();
    return rows.some((r) => r.userId === ctx.user._id);
  },
});

export const add = authedMutation({
  args: {
    targetType: targetTypeValidator,
    targetId: v.string(),
    label: v.string(),
  },
  returns: v.id("watchlists"),
  handler: async (ctx, args) => {
    // Dedupe: one row per (user, targetType, targetId).
    const existing = await ctx.db
      .query("watchlists")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId),
      )
      .collect();
    const mine = existing.find((r) => r.userId === ctx.user._id);
    if (mine) return mine._id;

    return await ctx.db.insert("watchlists", {
      userId: ctx.user._id,
      targetType: args.targetType,
      targetId: args.targetId,
      label: args.label,
      createdAt: Date.now(),
    });
  },
});

export const remove = authedMutation({
  args: { watchlistId: v.id("watchlists") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("watchlists", args.watchlistId);
    if (!row) throw new Error("Watchlist entry not found");
    if (row.userId !== ctx.user._id) throw new Error("Unauthorized");
    await ctx.db.delete("watchlists", args.watchlistId);
    return null;
  },
});
