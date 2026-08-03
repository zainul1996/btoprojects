import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation } from "./lib/auth";

/** In-app-only delivery for the transactional alertEvents outbox. */

interface DeliveryPageResult {
  eventId: Id<"alertEvents"> | null;
  phaseProcessed: "project" | "town" | null;
  watchersProcessed: number;
  alertsCreated: number;
  eventDelivered: boolean;
}

async function createAlert(
  ctx: MutationCtx,
  fields: {
    userId: Id<"users">;
    kind: Doc<"alerts">["kind"];
    title: string;
    body: string;
    projectId?: Id<"projects">;
    alertEventId?: Id<"alertEvents">;
  },
): Promise<Id<"alerts">> {
  return await ctx.db.insert("alerts", {
    userId: fields.userId,
    kind: fields.kind,
    title: fields.title,
    body: fields.body,
    projectId: fields.projectId,
    alertEventId: fields.alertEventId,
    read: false,
    deliveredVia: ["inapp"],
    createdAt: Date.now(),
  });
}

export const deliverPendingEvents = internalMutation({
  args: { limit: v.number() },
  returns: v.object({
    eventId: v.union(v.id("alertEvents"), v.null()),
    phaseProcessed: v.union(
      v.literal("project"),
      v.literal("town"),
      v.null(),
    ),
    watchersProcessed: v.number(),
    alertsCreated: v.number(),
    eventDelivered: v.boolean(),
  }),
  handler: async (ctx, args): Promise<DeliveryPageResult> => {
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit)));
    const event = await ctx.db
      .query("alertEvents")
      .withIndex("by_status_and_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .first();
    if (!event) {
      return {
        eventId: null,
        phaseProcessed: null,
        watchersProcessed: 0,
        alertsCreated: 0,
        eventDelivered: false,
      };
    }

    const project = await ctx.db.get("projects", event.projectId);
    if (!project) {
      const deliveryError = `Alert event project not found: ${event.projectId}`;
      console.error(deliveryError);
      await ctx.db.patch("alertEvents", event._id, {
        status: "delivered",
        deliveredAt: Date.now(),
        deliveryCursor: undefined,
        deliveryError,
      });
      return {
        eventId: event._id,
        phaseProcessed: event.deliveryPhase ?? "project",
        watchersProcessed: 0,
        alertsCreated: 0,
        eventDelivered: true,
      };
    }
    const phase: "project" | "town" = event.deliveryPhase ?? "project";
    const town =
      phase === "town" ? await ctx.db.get("towns", project.townId) : null;
    if (phase === "town" && !town) {
      const deliveryError = `Alert event town not found: ${project.townId}`;
      console.error(deliveryError);
      await ctx.db.patch("alertEvents", event._id, {
        status: "delivered",
        deliveredAt: Date.now(),
        deliveryCursor: undefined,
        deliveryError,
      });
      return {
        eventId: event._id,
        phaseProcessed: "town",
        watchersProcessed: 0,
        alertsCreated: 0,
        eventDelivered: true,
      };
    }

    const targetId = phase === "project" ? project.slug : town!.name;
    const page = await ctx.db
      .query("watchlists")
      .withIndex("by_target", (q) =>
        q.eq("targetType", phase).eq("targetId", targetId),
      )
      .paginate({
        numItems: limit,
        cursor: event.deliveryCursor ?? null,
      });
    let alertsCreated = 0;

    for (const watch of page.page) {
      const existingAlert = await ctx.db
        .query("alerts")
        .withIndex("by_event_and_user", (q) =>
          q.eq("alertEventId", event._id).eq("userId", watch.userId),
        )
        .unique();
      if (!existingAlert) {
        await createAlert(ctx, {
          userId: watch.userId,
          kind: "project_update",
          title: event.title,
          body: event.body,
          projectId: event.projectId,
          alertEventId: event._id,
        });
        alertsCreated++;
      }
    }

    let eventDelivered = false;
    if (!page.isDone) {
      await ctx.db.patch("alertEvents", event._id, {
        deliveryPhase: phase,
        deliveryCursor: page.continueCursor,
      });
    } else if (phase === "project") {
      await ctx.db.patch("alertEvents", event._id, {
        deliveryPhase: "town",
        deliveryCursor: undefined,
      });
    } else {
      await ctx.db.patch("alertEvents", event._id, {
        status: "delivered",
        deliveredAt: Date.now(),
        deliveryPhase: "town",
        deliveryCursor: undefined,
      });
      eventDelivered = true;
    }

    return {
      eventId: event._id,
      phaseProcessed: phase,
      watchersProcessed: page.page.length,
      alertsCreated,
      eventDelivered,
    };
  },
});

const DELIVERY_PAGE_SIZE = 50;
const MAX_PAGES_PER_WORKER = 10;
const CONTINUATION_DELAY_MS = 1_000;

/**
 * Durable bounded drain worker. Each page commits independently through
 * deliverPendingEvents; reaching the cap schedules another internal worker.
 * Duplicate workers are safe because page progress and alert dedupe are
 * transactional.
 */
export const drainPendingEvents = internalAction({
  args: {},
  returns: v.object({
    pagesProcessed: v.number(),
    continuationScheduled: v.boolean(),
  }),
  handler: async (ctx) => {
    let pagesProcessed = 0;
    for (let page = 0; page < MAX_PAGES_PER_WORKER; page++) {
      const result = await ctx.runMutation(
        internal.alertsEngine.deliverPendingEvents,
        { limit: DELIVERY_PAGE_SIZE },
      );
      if (result.eventId === null) {
        return { pagesProcessed, continuationScheduled: false };
      }
      pagesProcessed++;
    }

    await ctx.scheduler.runAfter(
      CONTINUATION_DELAY_MS,
      internal.alertsEngine.drainPendingEvents,
      {},
    );
    return { pagesProcessed, continuationScheduled: true };
  },
});

/** Lets a signed-in user verify the in-app alert loop on demand. */
export const sendMeTestAlert = authedMutation({
  args: {},
  returns: v.object({ alertId: v.id("alerts") }),
  handler: async (ctx) => {
    const alertId = await ctx.db.insert("alerts", {
      userId: ctx.user._id,
      kind: "test",
      title: "Test alert from BTOProjects.sg",
      body: "Your in-app alerts are working — official project updates will appear here.",
      read: false,
      deliveredVia: ["inapp"],
      createdAt: Date.now(),
    });
    return { alertId };
  },
});
