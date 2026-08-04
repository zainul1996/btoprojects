/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.{ts,js}");

async function addSource(
  t: ReturnType<typeof convexTest>,
  retrievedAt: number,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("sources", {
      url: `https://data.gov.sg/example/${retrievedAt}`,
      publisher: "Example agency",
      kind: "datagov",
      title: "Example amenity snapshot",
      retrievedAt,
    });
  });
}

function hawker(
  externalId: string,
  name: string,
  lat: number | undefined,
  lng: number | undefined,
) {
  return {
    externalId,
    name,
    category: "hawker" as const,
    status: "current" as const,
    lat,
    lng,
    geometryAccuracy: "exact" as const,
    geometryRole: "site" as const,
  };
}

describe("amenity map data", () => {
  it("stores only usable records and includes points on viewport edges", async () => {
    const t = convexTest(schema, modules);
    const sourceId = await addSource(t, 1000);

    const result = await t.mutation(internal.amenities.upsertBatch, {
      sourceKey: "datagov:hawkers",
      sourceId,
      records: [
        hawker("one", "Edge Market", 1.3, 103.8),
        hawker("", "Missing identity", 1.31, 103.81),
        hawker("two", "Missing point", undefined, undefined),
      ],
    });
    expect(result).toMatchObject({
      inserted: 1,
      skippedInvalidIdentity: 1,
      skippedMissingCoordinates: 1,
    });
    await t.mutation(internal.amenities.finalizeSnapshot, {
      sourceKey: "datagov:hawkers",
      sourceId,
    });

    const layer = await t.query(api.amenities.listInBounds, {
      category: "hawker",
      bounds: { south: 1.3, north: 1.3, west: 103.8, east: 103.8 },
    });
    expect(layer).toMatchObject({
      truncated: false,
      requiresCloserZoom: false,
    });
    expect(layer.amenities).toHaveLength(1);
    expect(layer.amenities[0]?.amenity.name).toBe("Edge Market");
    expect(layer.amenities[0]?.source.publisher).toBe("Example agency");
  });

  it("requires a closer zoom instead of scanning an unbounded viewport", async () => {
    const t = convexTest(schema, modules);
    const layer = await t.query(api.amenities.listInBounds, {
      category: "bus_stop",
      bounds: { south: 1.0, north: 1.6, west: 103.4, east: 104.2 },
    });
    expect(layer).toEqual({
      amenities: [],
      truncated: false,
      requiresCloserZoom: true,
    });
  });

  it("keeps the old snapshot until a successful finalisation", async () => {
    const t = convexTest(schema, modules);
    const firstSourceId = await addSource(t, 1000);
    await t.mutation(internal.amenities.upsertBatch, {
      sourceKey: "datagov:hawkers",
      sourceId: firstSourceId,
      records: [
        hawker("one", "First Market", 1.3, 103.8),
        hawker("two", "Second Market", 1.31, 103.81),
      ],
    });
    await t.mutation(internal.amenities.finalizeSnapshot, {
      sourceKey: "datagov:hawkers",
      sourceId: firstSourceId,
    });

    const secondSourceId = await addSource(t, 2000);
    await t.mutation(internal.amenities.upsertBatch, {
      sourceKey: "datagov:hawkers",
      sourceId: secondSourceId,
      records: [hawker("two", "Second Market renamed", 1.31, 103.81)],
    });

    const beforeFinalise = await t.run(async (ctx) =>
      await ctx.db.query("amenities").collect(),
    );
    expect(beforeFinalise).toHaveLength(2);
    expect(beforeFinalise.map((row) => row.name).sort()).toEqual([
      "First Market",
      "Second Market",
    ]);

    expect(
      await t.mutation(internal.amenities.discardSnapshot, {
        sourceKey: "datagov:hawkers",
        sourceId: secondSourceId,
      }),
    ).toEqual({ removed: 1 });
    const afterDiscard = await t.run(async (ctx) =>
      await ctx.db.query("amenities").collect(),
    );
    expect(afterDiscard.map((row) => row.name).sort()).toEqual([
      "First Market",
      "Second Market",
    ]);

    await t.mutation(internal.amenities.upsertBatch, {
      sourceKey: "datagov:hawkers",
      sourceId: secondSourceId,
      records: [hawker("two", "Second Market renamed", 1.31, 103.81)],
    });

    const finalised = await t.mutation(
      internal.amenities.finalizeSnapshot,
      { sourceKey: "datagov:hawkers", sourceId: secondSourceId },
    );
    expect(finalised).toEqual({ retained: 1, removed: 1 });
    const afterFinalise = await t.run(async (ctx) =>
      await ctx.db.query("amenities").collect(),
    );
    expect(afterFinalise.map((row) => row.name)).toEqual([
      "Second Market renamed",
    ]);
  });

  it("rejects snapshots above the atomic publication safety limit", async () => {
    const t = convexTest(schema, modules);
    const sourceId = await addSource(t, 3000);
    await t.run(async (ctx) => {
      for (let index = 0; index < 5001; index++) {
        await ctx.db.insert("amenityStaging", {
          sourceKey: "datagov:dense",
          externalId: String(index),
          sourceId,
          name: `Point ${index}`,
          category: "bus_stop",
          status: "current",
          lat: 1.3,
          lng: 103.8,
          spatialCell: "1826:5676",
          geometryAccuracy: "exact",
          geometryRole: "site",
          lastVerifiedAt: 3000,
        });
      }
    });

    await expect(
      t.mutation(internal.amenities.finalizeSnapshot, {
        sourceKey: "datagov:dense",
        sourceId,
      }),
    ).rejects.toThrow("5000 row safety limit");
  });
});
