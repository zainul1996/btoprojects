/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.{ts,js}");

async function seedProject(
  lifecycleStatus: "announced" | "launched" = "launched",
  slug = "example-grove",
) {
  const t = convexTest(schema, modules);
  const seeded = await t.run(async (ctx) => {
    const townId = await ctx.db.insert("towns", {
      name: "Bedok",
      region: "East",
      lat: 1.32,
      lng: 103.93,
    });
    const exerciseId = await ctx.db.insert("exercises", {
      key: "2026-06",
      label: "June 2026 BTO",
      type: "bto",
      status: "open",
    });
    const projectId = await ctx.db.insert("projects", {
      slug,
      name: "Example Grove",
      townId,
      exerciseId,
      region: "East",
      classification: "Standard",
      lifecycleStatus,
      saleType: "bto",
      lat: 1.32,
      lng: 103.93,
      description: "Test project",
      totalUnits: 500,
      estimatedWaitMonths: 36,
      estimatedCompletion: "2029-06",
      nearestMrt: [],
      mrtWalkingMinutes: 10,
      updatedAt: Date.now(),
    });
    return { townId, exerciseId, projectId };
  });
  return { t, ...seeded };
}

const source = {
  url: "https://example.test/BTO202606.json",
  publisher: "HDB",
  title: "BTO202606 application rates",
};

function factBatch(
  projectId: Id<"projects">,
  applicantCount: string,
) {
  return {
    projectId,
    exerciseKey: "2026-06",
    exerciseLabel: "June 2026 BTO",
    kind: "bto" as const,
    projectName: "Example Grove",
    townName: "Bedok",
    source,
    facts: [
      { field: "flatType.4-room.units", value: "500" },
      {
        field: "flatType.4-room.applicants",
        value: applicantCount,
      },
    ],
  };
}

describe("HDB transactional alert outbox", () => {
  it("atomically queues one event, dedupes repeats, and keys reversions separately", async () => {
    const { t, projectId } = await seedProject();

    const first = await t.mutation(
      internal.ingest.hdb.applyOfficialFactBatch,
      factBatch(projectId, "1200"),
    );
    expect(first).toMatchObject({ inserted: 2, eventQueued: true });

    const repeated = await t.mutation(
      internal.ingest.hdb.applyOfficialFactBatch,
      factBatch(projectId, "1200"),
    );
    expect(repeated).toMatchObject({ unchanged: 2, eventQueued: false });

    await t.mutation(
      internal.ingest.hdb.applyOfficialFactBatch,
      factBatch(projectId, "1234"),
    );
    await t.mutation(
      internal.ingest.hdb.applyOfficialFactBatch,
      factBatch(projectId, "1200"),
    );

    const state = await t.run(async (ctx) => ({
      facts: await ctx.db.query("projectFacts").collect(),
      events: await ctx.db.query("alertEvents").collect(),
      sources: await ctx.db.query("sources").collect(),
    }));
    expect(state.facts).toHaveLength(4);
    expect(state.events).toHaveLength(3);
    expect(new Set(state.events.map((event) => event.eventKey)).size).toBe(3);
    expect(state.sources).toHaveLength(1);
  });

  it("resumes delivery across pages and dedupes project plus town followers", async () => {
    const { t, projectId } = await seedProject();
    const eventId = await t.run(async (ctx) => {
      const users: Id<"users">[] = [];
      for (let index = 0; index < 70; index++) {
        users.push(
          await ctx.db.insert("users", {
            tokenIdentifier: `user-${index}`,
          }),
        );
      }
      for (let index = 0; index < 60; index++) {
        await ctx.db.insert("watchlists", {
          userId: users[index]!,
          targetType: "project",
          targetId: "example-grove",
          label: "Example Grove",
          createdAt: index,
        });
      }
      for (let index = 59; index < 70; index++) {
        await ctx.db.insert("watchlists", {
          userId: users[index]!,
          targetType: "town",
          targetId: "Bedok",
          label: "Bedok",
          createdAt: index,
        });
      }
      return await ctx.db.insert("alertEvents", {
        projectId,
        eventKey: "delivery-test",
        title: "Official update",
        body: "View details.",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const first = await t.mutation(
      internal.alertsEngine.deliverPendingEvents,
      { limit: 50 },
    );
    expect(first).toMatchObject({
      eventId,
      phaseProcessed: "project",
      watchersProcessed: 50,
      eventDelivered: false,
    });
    const second = await t.mutation(
      internal.alertsEngine.deliverPendingEvents,
      { limit: 50 },
    );
    expect(second).toMatchObject({
      phaseProcessed: "project",
      watchersProcessed: 10,
      eventDelivered: false,
    });
    const third = await t.mutation(
      internal.alertsEngine.deliverPendingEvents,
      { limit: 50 },
    );
    expect(third).toMatchObject({
      phaseProcessed: "town",
      watchersProcessed: 11,
      eventDelivered: true,
    });

    const delivered = await t.run(async (ctx) => ({
      event: await ctx.db.get("alertEvents", eventId),
      alerts: await ctx.db.query("alerts").collect(),
    }));
    expect(delivered.event?.status).toBe("delivered");
    expect(delivered.alerts).toHaveLength(70);
    expect(
      new Set(delivered.alerts.map((alert) => alert.userId)).size,
    ).toBe(70);
    expect(
      delivered.alerts.every((alert) => alert.alertEventId === eventId),
    ).toBe(true);
  });

  it("schedules continuation so work beyond the page cap completes", async () => {
    vi.useFakeTimers();
    try {
      const { t, projectId } = await seedProject();
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          tokenIdentifier: "continuation-user",
        });
        await ctx.db.insert("watchlists", {
          userId,
          targetType: "project",
          targetId: "example-grove",
          label: "Example Grove",
          createdAt: 0,
        });
        for (let index = 0; index < 6; index++) {
          await ctx.db.insert("alertEvents", {
            projectId,
            eventKey: `continuation-${index}`,
            title: `Update ${index}`,
            body: "View details.",
            status: "pending",
            createdAt: index,
          });
        }
      });

      const firstWorker = await t.action(
        internal.alertsEngine.drainPendingEvents,
        {},
      );
      expect(firstWorker).toEqual({
        pagesProcessed: 10,
        continuationScheduled: true,
      });
      const afterFirstWorker = await t.run(async (ctx) => ({
        delivered: (
          await ctx.db
            .query("alertEvents")
            .withIndex("by_status_and_created", (q) =>
              q.eq("status", "delivered"),
            )
            .collect()
        ).length,
        pending: (
          await ctx.db
            .query("alertEvents")
            .withIndex("by_status_and_created", (q) =>
              q.eq("status", "pending"),
            )
            .collect()
        ).length,
      }));
      expect(afterFirstWorker).toEqual({ delivered: 5, pending: 1 });

      await t.finishAllScheduledFunctions(() => {
        vi.runAllTimers();
      });
      const finished = await t.run(async (ctx) => ({
        events: await ctx.db.query("alertEvents").collect(),
        alerts: await ctx.db.query("alerts").collect(),
      }));
      expect(finished.events.every((event) => event.status === "delivered")).toBe(
        true,
      );
      expect(finished.alerts).toHaveLength(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips a poison event without blocking the next valid event", async () => {
    const { t, projectId, townId, exerciseId } = await seedProject();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ids = await t.run(async (ctx) => {
        const doomedProjectId = await ctx.db.insert("projects", {
          slug: "deleted-project",
          name: "Deleted Project",
          townId,
          exerciseId,
          region: "East",
          classification: "Standard",
          lifecycleStatus: "launched",
          saleType: "bto",
          lat: 1.32,
          lng: 103.93,
          description: "Deleted test project",
          totalUnits: 100,
          estimatedWaitMonths: 12,
          estimatedCompletion: "2027-06",
          nearestMrt: [],
          mrtWalkingMinutes: 10,
          updatedAt: Date.now(),
        });
        const poisonEventId = await ctx.db.insert("alertEvents", {
          projectId: doomedProjectId,
          eventKey: "poison-event",
          title: "Poison",
          body: "Cannot deliver",
          status: "pending",
          createdAt: 1,
        });
        await ctx.db.delete("projects", doomedProjectId);

        const userId = await ctx.db.insert("users", {
          tokenIdentifier: "valid-after-poison",
        });
        await ctx.db.insert("watchlists", {
          userId,
          targetType: "project",
          targetId: "example-grove",
          label: "Example Grove",
          createdAt: 2,
        });
        const validEventId = await ctx.db.insert("alertEvents", {
          projectId,
          eventKey: "valid-after-poison",
          title: "Valid update",
          body: "View details.",
          status: "pending",
          createdAt: 2,
        });
        return { poisonEventId, validEventId };
      });

      const result = await t.action(
        internal.alertsEngine.drainPendingEvents,
        {},
      );
      expect(result.continuationScheduled).toBe(false);
      const state = await t.run(async (ctx) => ({
        poison: await ctx.db.get("alertEvents", ids.poisonEventId),
        valid: await ctx.db.get("alertEvents", ids.validEventId),
        alerts: await ctx.db.query("alerts").collect(),
      }));
      expect(state.poison).toMatchObject({
        status: "delivered",
        deliveryError: expect.stringContaining("project not found"),
      });
      expect(state.valid?.status).toBe("delivered");
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0]?.alertEventId).toBe(ids.validEventId);
      expect(errorLog).toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
  });

  it("migrates adopted-project watches in pages and removes duplicate users", async () => {
    const { t, projectId, townId, exerciseId } = await seedProject(
      "announced",
      "bedok-working-title",
    );
    await t.run(async (ctx) => {
      for (let index = 0; index < 60; index++) {
        const userId = await ctx.db.insert("users", {
          tokenIdentifier: `adopter-${index}`,
        });
        await ctx.db.insert("watchlists", {
          userId,
          targetType: "project",
          targetId: "bedok-working-title",
          label: "Bedok working title",
          createdAt: index,
        });
        if (index === 0) {
          await ctx.db.insert("watchlists", {
            userId,
            targetType: "project",
            targetId: "example-grove",
            label: "Example Grove",
            createdAt: index,
          });
        }
      }
    });

    const first = await t.mutation(
      internal.ingest.hdb.migrateAnnouncedProjectWatches,
      {
        shellId: projectId,
        oldSlug: "bedok-working-title",
        newSlug: "example-grove",
        newName: "Example Grove",
        limit: 50,
      },
    );
    expect(first).toMatchObject({ processed: 50, done: false });
    expect(first.cursor).not.toBeNull();
    const second = await t.mutation(
      internal.ingest.hdb.migrateAnnouncedProjectWatches,
      {
        shellId: projectId,
        oldSlug: "bedok-working-title",
        newSlug: "example-grove",
        newName: "Example Grove",
        limit: 50,
        cursor: first.cursor!,
      },
    );
    expect(second).toMatchObject({ processed: 10, done: true });

    await t.mutation(
      internal.ingest.hdb.finalizeAnnouncedShellAdoption,
      {
        shellId: projectId,
        exerciseId,
        townId,
        oldSlug: "bedok-working-title",
        slug: "example-grove",
        name: "Example Grove",
        classification: "Standard",
      },
    );

    const adopted = await t.run(async (ctx) => ({
      project: await ctx.db.get("projects", projectId),
      oldWatches: await ctx.db
        .query("watchlists")
        .withIndex("by_target", (q) =>
          q
            .eq("targetType", "project")
            .eq("targetId", "bedok-working-title"),
        )
        .collect(),
      newWatches: await ctx.db
        .query("watchlists")
        .withIndex("by_target", (q) =>
          q.eq("targetType", "project").eq("targetId", "example-grove"),
        )
        .collect(),
    }));
    expect(adopted.project).toMatchObject({
      slug: "example-grove",
      lifecycleStatus: "launched",
    });
    expect(adopted.oldWatches).toHaveLength(0);
    expect(adopted.newWatches).toHaveLength(60);
    expect(
      new Set(adopted.newWatches.map((watch) => watch.userId)).size,
    ).toBe(60);
  });
});
