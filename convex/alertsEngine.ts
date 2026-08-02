import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation } from "./lib/auth";

/**
 * Alert fan-out: watchlist hits → in-app alerts → scheduled telegram batch.
 * Scheduler only ever runs internal* functions.
 */

async function createAlert(
  ctx: MutationCtx,
  fields: {
    userId: Id<"users">;
    kind: Doc<"alerts">["kind"];
    title: string;
    body: string;
    projectId?: Id<"projects">;
  },
): Promise<Id<"alerts">> {
  return await ctx.db.insert("alerts", {
    userId: fields.userId,
    kind: fields.kind,
    title: fields.title,
    body: fields.body,
    projectId: fields.projectId,
    read: false,
    deliveredVia: ["inapp"],
    createdAt: Date.now(),
  });
}

export const notifyProjectUpdate = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({ notified: v.number() }),
  handler: async (ctx, args) => {
    const project = await ctx.db.get("projects", args.projectId);
    if (!project) throw new Error("Project not found");
    const town = await ctx.db.get("towns", project.townId);

    // Watchers of this project OR of its town (watchlists store slugs/names).
    const targets: [Doc<"watchlists">["targetType"], string][] = [
      ["project", project.slug],
      ...(town ? ([["town", town.name]] as [Doc<"watchlists">["targetType"], string][]) : []),
    ];
    const watcherUserIds = new Set<Id<"users">>();
    for (const [targetType, targetId] of targets) {
      const rows = await ctx.db
        .query("watchlists")
        .withIndex("by_target", (q) =>
          q.eq("targetType", targetType).eq("targetId", targetId),
        )
        .collect();
      for (const row of rows) watcherUserIds.add(row.userId);
    }

    const deliveries: { alertId: Id<"alerts">; userId: Id<"users"> }[] = [];
    for (const userId of watcherUserIds) {
      const alertId = await createAlert(ctx, {
        userId,
        kind: "project_update",
        title: args.title,
        body: args.body,
        projectId: args.projectId,
      });
      deliveries.push({ alertId, userId });
    }

    if (deliveries.length > 0) {
      await ctx.scheduler.runAfter(0, internal.telegram.deliverTelegramBatch, {
        deliveries,
        title: args.title,
        body: args.body,
      });
    }
    return { notified: deliveries.length };
  },
});

/** W5-6 acceptance surrogate: lets a signed-in user verify end-to-end
 *  in-app + telegram delivery on demand. */
export const sendMeTestAlert = authedMutation({
  args: {},
  returns: v.object({ alertId: v.id("alerts") }),
  handler: async (ctx) => {
    const alertId = await ctx.db.insert("alerts", {
      userId: ctx.user._id,
      kind: "test",
      title: "Test alert from BTOProjects.sg",
      body: "Your alert pipeline is wired up — you will see project updates here and on Telegram.",
      read: false,
      deliveredVia: ["inapp"],
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.telegram.deliverTelegramBatch, {
      deliveries: [{ alertId, userId: ctx.user._id }],
      title: "Test alert from BTOProjects.sg",
      body: "Your alert pipeline is wired up — you will see project updates here and on Telegram.",
    });
    return { alertId };
  },
});
