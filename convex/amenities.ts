import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import {
  amenityCategoryValidator,
  amenityGeometryAccuracyValidator,
  amenityGeometryRoleValidator,
  amenityStatusValidator,
} from "./schema";
import { amenityValidator, sourceValidator } from "./lib/validators";

/**
 * Buyer-relevant map layers backed by attributed point data.
 *
 * The fixed grid keeps viewport reads bounded without pretending that a
 * truncated dense layer is complete. MRT/LRT remains in `mrtStations`.
 */

const CELL_SIZE_DEGREES = 0.05;
const MAX_VIEWPORT_CELLS = 80;
const MAX_RESULTS = 500;
const MAX_ROWS_PER_CELL = 75;
const MAX_INGEST_BATCH = 500;
// Finalisation may publish, remove and clear staging for every row in one
// transaction. Keep 3N below Convex's 16,000 document write cap.
const MAX_SNAPSHOT_ROWS = 5_000;

const boundsValidator = v.object({
  south: v.number(),
  west: v.number(),
  north: v.number(),
  east: v.number(),
});

const publicAmenityValidator = v.object({
  amenity: amenityValidator,
  source: sourceValidator,
});

export const amenityLayerResultValidator = v.object({
  amenities: v.array(publicAmenityValidator),
  truncated: v.boolean(),
  requiresCloserZoom: v.boolean(),
});

function validBounds(bounds: {
  south: number;
  west: number;
  north: number;
  east: number;
}): boolean {
  return (
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.north) &&
    Number.isFinite(bounds.east) &&
    bounds.south >= -90 &&
    bounds.north <= 90 &&
    bounds.west >= -180 &&
    bounds.east <= 180 &&
    bounds.south <= bounds.north &&
    bounds.west <= bounds.east
  );
}

function cellIndex(coordinate: number, offset: number): number {
  return Math.floor((coordinate + offset) / CELL_SIZE_DEGREES);
}

function spatialCellFor(lat: number, lng: number): string {
  return `${cellIndex(lat, 90)}:${cellIndex(lng, 180)}`;
}

function cellsForBounds(bounds: {
  south: number;
  west: number;
  north: number;
  east: number;
}): string[] | null {
  const south = cellIndex(bounds.south, 90);
  const north = cellIndex(bounds.north, 90);
  const west = cellIndex(bounds.west, 180);
  const east = cellIndex(bounds.east, 180);
  const count = (north - south + 1) * (east - west + 1);
  if (count > MAX_VIEWPORT_CELLS) return null;

  const cells: string[] = [];
  for (let latCell = south; latCell <= north; latCell++) {
    for (let lngCell = west; lngCell <= east; lngCell++) {
      cells.push(`${latCell}:${lngCell}`);
    }
  }
  return cells;
}

export const listInBounds = query({
  args: {
    category: amenityCategoryValidator,
    bounds: boundsValidator,
    statuses: v.optional(v.array(amenityStatusValidator)),
  },
  returns: amenityLayerResultValidator,
  handler: async (ctx, args) => {
    if (!validBounds(args.bounds)) {
      throw new Error("Map bounds are invalid");
    }

    const cells = cellsForBounds(args.bounds);
    if (!cells) {
      return { amenities: [], truncated: false, requiresCloserZoom: true };
    }

    const statuses = [...new Set(args.statuses ?? ["current"])] as Array<
      "current" | "planned"
    >;
    if (statuses.length === 0 || statuses.length > 2) {
      throw new Error("Choose one or two amenity statuses");
    }

    const rows = [];
    let truncated = false;
    for (const status of statuses) {
      for (const cell of cells) {
        const cellRows = await ctx.db
          .query("amenities")
          .withIndex("by_category_status_cell", (q) =>
            q
              .eq("category", args.category)
              .eq("status", status)
              .eq("spatialCell", cell),
          )
          .take(MAX_ROWS_PER_CELL + 1);
        if (cellRows.length > MAX_ROWS_PER_CELL) truncated = true;
        rows.push(...cellRows.slice(0, MAX_ROWS_PER_CELL));
      }
    }

    const inBounds = rows.filter(
      (row) =>
        row.lat >= args.bounds.south &&
        row.lat <= args.bounds.north &&
        row.lng >= args.bounds.west &&
        row.lng <= args.bounds.east,
    );
    if (inBounds.length > MAX_RESULTS) truncated = true;
    const limited = inBounds.slice(0, MAX_RESULTS);

    // Deduplicate source reads so provenance joins stay bounded by the result
    // cap even when many amenities share one retrieval.
    const sourceIds = [...new Set(limited.map((row) => row.sourceId))];
    const sources = await Promise.all(
      sourceIds.map((id) => ctx.db.get("sources", id)),
    );
    const sourceById = new Map(
      sources
        .filter((source) => source !== null)
        .map((source) => [source._id, source]),
    );
    const amenities = limited.flatMap((amenity) => {
      const source = sourceById.get(amenity.sourceId);
      return source ? [{ amenity, source }] : [];
    });

    if (amenities.length !== limited.length) truncated = true;
    return { amenities, truncated, requiresCloserZoom: false };
  },
});

const ingestAmenityValidator = v.object({
  externalId: v.string(),
  name: v.string(),
  category: amenityCategoryValidator,
  status: amenityStatusValidator,
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  geometryAccuracy: amenityGeometryAccuracyValidator,
  geometryRole: amenityGeometryRoleValidator,
  address: v.optional(v.string()),
  effectiveDate: v.optional(v.string()),
});

/**
 * Idempotent storage seam for official dataset adapters.
 *
 * Callers create one `sources` row for the fetch, then send bounded batches
 * here. Records without usable coordinates are counted but not staged.
 * Status must come from the source adapter and is never inferred here.
 */
export const upsertBatch = internalMutation({
  args: {
    sourceKey: v.string(),
    sourceId: v.id("sources"),
    records: v.array(ingestAmenityValidator),
  },
  returns: v.object({
    inserted: v.number(),
    updated: v.number(),
    unchanged: v.number(),
    skippedInvalidIdentity: v.number(),
    skippedMissingCoordinates: v.number(),
    skippedInvalidCoordinates: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!args.sourceKey.trim()) throw new Error("sourceKey is required");
    if (args.records.length > MAX_INGEST_BATCH) {
      throw new Error(`Amenity batches are limited to ${MAX_INGEST_BATCH} records`);
    }
    const source = await ctx.db.get("sources", args.sourceId);
    if (!source) throw new Error("Amenity source record was not found");

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let skippedInvalidIdentity = 0;
    let skippedMissingCoordinates = 0;
    let skippedInvalidCoordinates = 0;

    for (const record of args.records) {
      const externalId = record.externalId.trim();
      if (!externalId || !record.name.trim()) {
        skippedInvalidIdentity++;
        continue;
      }
      if (record.lat === undefined || record.lng === undefined) {
        skippedMissingCoordinates++;
        continue;
      }
      if (
        !Number.isFinite(record.lat) ||
        !Number.isFinite(record.lng) ||
        record.lat < -90 ||
        record.lat > 90 ||
        record.lng < -180 ||
        record.lng > 180
      ) {
        skippedInvalidCoordinates++;
        continue;
      }

      const sourceKey = args.sourceKey.trim();
      const spatialCell = spatialCellFor(record.lat, record.lng);
      const existing = await ctx.db
        .query("amenityStaging")
        .withIndex("by_source_and_record", (q) =>
          q
            .eq("sourceId", args.sourceId)
            .eq("sourceKey", sourceKey)
            .eq("externalId", externalId),
        )
        .unique();

      const values = {
        sourceKey,
        externalId,
        sourceId: args.sourceId,
        name: record.name.trim(),
        category: record.category,
        status: record.status,
        lat: record.lat,
        lng: record.lng,
        spatialCell,
        geometryAccuracy: record.geometryAccuracy,
        geometryRole: record.geometryRole,
        address: record.address?.trim() || undefined,
        effectiveDate: record.effectiveDate || undefined,
        lastVerifiedAt: source.retrievedAt,
      };

      if (!existing) {
        await ctx.db.insert("amenityStaging", values);
        inserted++;
        continue;
      }

      const contentChanged =
        existing.name !== values.name ||
        existing.category !== values.category ||
        existing.status !== values.status ||
        existing.lat !== values.lat ||
        existing.lng !== values.lng ||
        existing.spatialCell !== values.spatialCell ||
        existing.geometryAccuracy !== values.geometryAccuracy ||
        existing.geometryRole !== values.geometryRole ||
        existing.address !== values.address ||
        existing.effectiveDate !== values.effectiveDate;
      await ctx.db.patch("amenityStaging", existing._id, values);
      if (contentChanged) updated++;
      else unchanged++;
    }

    return {
      inserted,
      updated,
      unchanged,
      skippedInvalidIdentity,
      skippedMissingCoordinates,
      skippedInvalidCoordinates,
    };
  },
});

/**
 * Converge a fully ingested source snapshot.
 *
 * Only call this after all batches succeed. The transaction publishes the
 * staging rows and removes untouched active rows atomically. A failure before
 * finalisation leaves the last complete snapshot unchanged.
 */
export const finalizeSnapshot = internalMutation({
  args: {
    sourceKey: v.string(),
    sourceId: v.id("sources"),
  },
  returns: v.object({ retained: v.number(), removed: v.number() }),
  handler: async (ctx, args) => {
    const sourceKey = args.sourceKey.trim();
    if (!sourceKey) throw new Error("sourceKey is required");
    const source = await ctx.db.get("sources", args.sourceId);
    if (!source) throw new Error("Amenity source record was not found");

    const stagedRows = await ctx.db
      .query("amenityStaging")
      .withIndex("by_source_and_record", (q) =>
        q.eq("sourceId", args.sourceId).eq("sourceKey", sourceKey),
      )
      .take(MAX_SNAPSHOT_ROWS + 1);
    if (stagedRows.length > MAX_SNAPSHOT_ROWS) {
      throw new Error(
        `Amenity snapshot exceeds the ${MAX_SNAPSHOT_ROWS} row safety limit`,
      );
    }

    const currentRows = await ctx.db
      .query("amenities")
      .withIndex("by_source_record", (q) => q.eq("sourceKey", sourceKey))
      .take(MAX_SNAPSHOT_ROWS + 1);
    if (currentRows.length > MAX_SNAPSHOT_ROWS) {
      throw new Error(
        `Published amenity source exceeds the ${MAX_SNAPSHOT_ROWS} row safety limit`,
      );
    }
    if (stagedRows.length === 0) {
      if (
        currentRows.length > 0 &&
        currentRows.every((row) => row.sourceId === args.sourceId)
      ) {
        return { retained: currentRows.length, removed: 0 };
      }
      throw new Error("Cannot finalise an empty amenity snapshot");
    }

    const currentByExternalId = new Map(
      currentRows.map((row) => [row.externalId, row]),
    );
    const stagedExternalIds = new Set<string>();
    for (const staged of stagedRows) {
      stagedExternalIds.add(staged.externalId);
      const values = {
        sourceKey: staged.sourceKey,
        externalId: staged.externalId,
        sourceId: staged.sourceId,
        name: staged.name,
        category: staged.category,
        status: staged.status,
        lat: staged.lat,
        lng: staged.lng,
        spatialCell: staged.spatialCell,
        geometryAccuracy: staged.geometryAccuracy,
        geometryRole: staged.geometryRole,
        address: staged.address,
        effectiveDate: staged.effectiveDate,
        lastVerifiedAt: staged.lastVerifiedAt,
      };
      const current = currentByExternalId.get(staged.externalId);
      if (current) await ctx.db.patch("amenities", current._id, values);
      else await ctx.db.insert("amenities", values);
    }

    let removed = 0;
    for (const row of currentRows) {
      if (!stagedExternalIds.has(row.externalId)) {
        await ctx.db.delete("amenities", row._id);
        removed++;
      }
    }
    for (const staged of stagedRows) {
      await ctx.db.delete("amenityStaging", staged._id);
    }
    return { retained: stagedRows.length, removed };
  },
});

/** Clear a failed fetch's staging rows without touching published data. */
export const discardSnapshot = internalMutation({
  args: {
    sourceKey: v.string(),
    sourceId: v.id("sources"),
  },
  returns: v.object({ removed: v.number() }),
  handler: async (ctx, args) => {
    const sourceKey = args.sourceKey.trim();
    if (!sourceKey) throw new Error("sourceKey is required");
    const stagedRows = await ctx.db
      .query("amenityStaging")
      .withIndex("by_source_and_record", (q) =>
        q.eq("sourceId", args.sourceId).eq("sourceKey", sourceKey),
      )
      .take(MAX_SNAPSHOT_ROWS + 1);
    if (stagedRows.length > MAX_SNAPSHOT_ROWS) {
      throw new Error(
        `Amenity snapshot exceeds the ${MAX_SNAPSHOT_ROWS} row safety limit`,
      );
    }
    for (const staged of stagedRows) {
      await ctx.db.delete("amenityStaging", staged._id);
    }
    return { removed: stagedRows.length };
  },
});
