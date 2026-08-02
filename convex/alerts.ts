import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { authedMutation, authedQuery } from "./lib/auth";
import { alertValidator } from "./lib/validators";

export const listMine = authedQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(alertValidator),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const unreadCount = authedQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("alerts")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", ctx.user._id).eq("read", false),
      )
      .collect();
    return unread.length;
  },
});

export const markRead = authedMutation({
  args: { alertId: v.id("alerts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("alerts", args.alertId);
    if (!alert) throw new Error("Alert not found");
    if (alert.userId !== ctx.user._id) throw new Error("Unauthorized");
    if (!alert.read) {
      await ctx.db.patch("alerts", args.alertId, { read: true });
    }
    return null;
  },
});

export const markAllRead = authedMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("alerts")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", ctx.user._id).eq("read", false),
      )
      .collect();
    await Promise.all(
      unread.map((alert) => ctx.db.patch("alerts", alert._id, { read: true })),
    );
    return unread.length;
  },
});
