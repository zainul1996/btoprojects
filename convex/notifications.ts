import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Internal mutations backing the "use node" telegram adapter: delivery
 * bookkeeping (notificationLog rows + alerts.deliveredVia).
 */

export const log = internalMutation({
  args: {
    alertId: v.optional(v.id("alerts")),
    channel: v.union(v.literal("telegram"), v.literal("log")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationLog", {
      alertId: args.alertId,
      channel: args.channel,
      status: args.status,
      detail: args.detail,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const appendDeliveredVia = internalMutation({
  args: { alertId: v.id("alerts"), channel: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("alerts", args.alertId);
    if (!alert) return null;
    if (!alert.deliveredVia.includes(args.channel)) {
      await ctx.db.patch("alerts", args.alertId, {
        deliveredVia: [...alert.deliveredVia, args.channel],
      });
    }
    return null;
  },
});
