import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { authedMutation, authedQuery } from "./lib/auth";

const alertListItemValidator = v.object({
  _id: v.id("alerts"),
  _creationTime: v.number(),
  userId: v.id("users"),
  kind: v.union(
    v.literal("project_update"),
    v.literal("new_launch"),
    v.literal("exercise_open"),
    v.literal("system"),
    v.literal("test"),
  ),
  title: v.string(),
  body: v.string(),
  projectId: v.optional(v.id("projects")),
  alertEventId: v.optional(v.id("alertEvents")),
  projectSlug: v.optional(v.string()),
  read: v.boolean(),
  deliveredVia: v.array(v.string()),
  createdAt: v.number(),
});

export const listMine = authedQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(alertListItemValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("alerts")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (alert) => {
        if (!alert.projectId) return { ...alert, projectSlug: undefined };
        const project = await ctx.db.get("projects", alert.projectId);
        return {
          ...alert,
          projectSlug: project?.slug,
        };
      }),
    );
    return { ...result, page };
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
