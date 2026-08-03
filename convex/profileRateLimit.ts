import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_RESOLVES = 10;

export const consumeGeocode = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    now: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
    if (!user) return false;

    const windowStart = Math.floor(args.now / WINDOW_MS) * WINDOW_MS;
    const existing = await ctx.db
      .query("geocodeRateLimits")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (
      existing?.windowStart === windowStart &&
      existing.count >= MAX_RESOLVES
    ) {
      return false;
    }
    if (existing) {
      await ctx.db.patch("geocodeRateLimits", existing._id, {
        windowStart,
        count:
          existing.windowStart === windowStart ? existing.count + 1 : 1,
      });
    } else {
      await ctx.db.insert("geocodeRateLimits", {
        userId: user._id,
        windowStart,
        count: 1,
      });
    }
    return true;
  },
});
