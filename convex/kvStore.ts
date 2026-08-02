import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Tiny key-value helpers (OneMap token cache). Actions cannot touch the db
 * directly, so "use node" adapter files go through these.
 */

export const get = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kv")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
  },
});

export const set = internalMutation({
  args: {
    key: v.string(),
    value: v.string(),
    expiresAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("kv")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch("kv", existing._id, {
        value: args.value,
        expiresAt: args.expiresAt,
      });
    } else {
      await ctx.db.insert("kv", {
        key: args.key,
        value: args.value,
        expiresAt: args.expiresAt,
      });
    }
    return null;
  },
});
