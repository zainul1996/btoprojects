"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { seedProjects } from "./seedData";

/**
 * data.gov.sg adapters. Resale transactions are comparables only — never
 * future-value predictions (product guardrail: no certainty theatre).
 *
 * Dev-tier API key allows 8 datastore calls / 10s, so town fetches are
 * serialized with ~1.5s gaps. See docs/DATA_SOURCES.md for rate tiers.
 * Db writes live in convex/ingestion.ts (actions cannot access ctx.db).
 */

const RESALE_RESOURCE_ID = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
const SCHOOLS_RESOURCE_ID = "d_688b934f82c1059ed0a6993d2a829089";
const DATASTORE_URL = "https://data.gov.sg/api/action/datastore_search";
const TOWN_FETCH_GAP_MS = 1500;
const PER_TOWN_LIMIT = 100;

// Towns covered by the seeded projects — comparables exist for these only.
const SEED_TOWNS = [...new Set(seedProjects.map((p) => p.town))];

interface RawResaleRecord {
  month?: string;
  town?: string;
  flat_type?: string;
  block?: string;
  street_name?: string;
  storey_range?: string;
  floor_area_sqm?: string;
  flat_model?: string;
  lease_commence_date?: string;
  resale_price?: string;
}

interface DatastoreSearchResponse<T> {
  success?: boolean;
  result?: { records?: T[]; total?: number };
  errorMsg?: string;
}

interface ResaleRow {
  town: string;
  flatType: string;
  block: string;
  streetName: string;
  storeyRange: string;
  floorAreaSqm: number;
  flatModel: string;
  leaseCommenceDate: number;
  resalePrice: number;
  month: string;
}

/** data.gov.sg flat types → our flat-type naming (best effort). */
function mapFlatType(raw: string): string {
  switch (raw.toUpperCase().trim()) {
    case "1 ROOM":
      return "1-room";
    case "2 ROOM":
      return "2-room Flexi";
    case "3 ROOM":
      return "3-room";
    case "4 ROOM":
      return "4-room";
    case "5 ROOM":
      return "5-room";
    case "MULTI-GENERATION":
      return "3Gen";
    default:
      return raw.trim();
  }
}

function mapResaleRecord(raw: RawResaleRecord, seedTown: string): ResaleRow | null {
  if (
    !raw.month ||
    !raw.block ||
    !raw.street_name ||
    !raw.flat_type ||
    !raw.resale_price
  ) {
    return null;
  }
  const resalePrice = Number(raw.resale_price);
  const floorAreaSqm = Number(raw.floor_area_sqm);
  const leaseCommenceDate = Number(raw.lease_commence_date);
  if (
    !Number.isFinite(resalePrice) ||
    !Number.isFinite(floorAreaSqm) ||
    !Number.isFinite(leaseCommenceDate)
  ) {
    return null;
  }
  return {
    // Store the seed town's canonical casing, not the dataset's UPPERCASE.
    town: seedTown,
    flatType: mapFlatType(raw.flat_type),
    block: raw.block.trim(),
    streetName: raw.street_name.trim(),
    storeyRange: raw.storey_range?.trim() ?? "",
    floorAreaSqm,
    flatModel: raw.flat_model?.trim() ?? "",
    leaseCommenceDate,
    resalePrice,
    month: raw.month,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTownResale(
  apiKey: string,
  town: string,
): Promise<RawResaleRecord[]> {
  const params = new URLSearchParams({
    resource_id: RESALE_RESOURCE_ID,
    limit: String(PER_TOWN_LIMIT),
    sort: "month desc",
    filters: JSON.stringify({ town: town.toUpperCase() }),
  });
  const res = await fetch(`${DATASTORE_URL}?${params}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `datastore_search ${town} failed: HTTP ${res.status} ${text.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as DatastoreSearchResponse<RawResaleRecord>;
  if (data.success === false) {
    throw new Error(
      `datastore_search ${town} rejected: ${data.errorMsg ?? "unknown error"}`,
    );
  }
  return data.result?.records ?? [];
}

interface SyncResaleResult {
  ok: boolean;
  inserted: number;
  fetched: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  towns: number;
  error?: string;
}

export const syncResale = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    inserted: v.number(),
    fetched: v.number(),
    skippedDuplicates: v.number(),
    skippedInvalid: v.number(),
    towns: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<SyncResaleResult> => {
    const apiKey = process.env.DATAGOV_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        inserted: 0,
        fetched: 0,
        skippedDuplicates: 0,
        skippedInvalid: 0,
        towns: 0,
        error: "DATAGOV_API_KEY not set on deployment",
      };
    }

    const jobId = await ctx.runMutation(internal.ingestion.startJob, {
      source: "datagov.resale",
    });
    try {
      const mapped: ResaleRow[] = [];
      let fetched = 0;
      let skippedInvalid = 0;

      for (const [index, town] of SEED_TOWNS.entries()) {
        if (index > 0) await sleep(TOWN_FETCH_GAP_MS);
        const raw = await fetchTownResale(apiKey, town);
        fetched += raw.length;
        for (const record of raw) {
          const row = mapResaleRecord(record, town);
          if (row) mapped.push(row);
          else skippedInvalid++;
        }
      }

      const { inserted, skippedDuplicates } = await ctx.runMutation(
        internal.ingestion.storeResale,
        { records: mapped },
      );

      const stats = {
        towns: SEED_TOWNS,
        fetched,
        inserted,
        skippedDuplicates,
        skippedInvalid,
      };
      await ctx.runMutation(internal.ingestion.finishJob, {
        jobId,
        status: "success",
        stats,
      });
      console.log(JSON.stringify({ fn: "datagov.syncResale", ...stats }));
      return {
        ok: true,
        inserted,
        fetched,
        skippedDuplicates,
        skippedInvalid,
        towns: SEED_TOWNS.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.ingestion.finishJob, {
        jobId,
        status: "failed",
        error: message,
      });
      console.log(
        JSON.stringify({ fn: "datagov.syncResale", ok: false, error: message }),
      );
      return {
        ok: false,
        inserted: 0,
        fetched: 0,
        skippedDuplicates: 0,
        skippedInvalid: 0,
        towns: SEED_TOWNS.length,
        error: message,
      };
    }
  },
});

interface RawSchoolRecord {
  school_name?: string;
  mainlevel_code?: string;
  address?: string;
}

function mapSchoolLevel(
  raw: string | undefined,
): "primary" | "secondary" | "mixed" | null {
  if (!raw) return null;
  const level = raw.toUpperCase();
  if (level.includes("MIXED")) return "mixed";
  if (level.includes("PRIMARY")) return "primary";
  if (level.includes("SECONDARY")) return "secondary";
  return null;
}

interface SyncSchoolsResult {
  ok: boolean;
  fetched: number;
  upserted: number;
  skipped: number;
  error?: string;
}

export const syncSchools = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    fetched: v.number(),
    upserted: v.number(),
    skipped: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<SyncSchoolsResult> => {
    const apiKey = process.env.DATAGOV_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        error: "DATAGOV_API_KEY not set on deployment",
      };
    }

    const jobId = await ctx.runMutation(internal.ingestion.startJob, {
      source: "datagov.schools",
    });
    try {
      const params = new URLSearchParams({
        resource_id: SCHOOLS_RESOURCE_ID,
        limit: "200",
      });
      const res = await fetch(`${DATASTORE_URL}?${params}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `schools fetch failed: HTTP ${res.status} ${text.slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as DatastoreSearchResponse<RawSchoolRecord>;
      const records = data.result?.records ?? [];

      let upserted = 0;
      let skipped = 0;
      for (const record of records) {
        const level = mapSchoolLevel(record.mainlevel_code);
        if (!record.school_name || !level) {
          skipped++;
          continue;
        }
        await ctx.runMutation(internal.ingestion.upsertSchool, {
          name: record.school_name.trim(),
          level,
          address: record.address?.trim() || undefined,
        });
        upserted++;
      }

      const stats = { fetched: records.length, upserted, skipped };
      await ctx.runMutation(internal.ingestion.finishJob, {
        jobId,
        status: "success",
        stats,
      });
      console.log(JSON.stringify({ fn: "datagov.syncSchools", ...stats }));
      return { ok: true, fetched: records.length, upserted, skipped };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.ingestion.finishJob, {
        jobId,
        status: "failed",
        error: message,
      });
      return { ok: false, fetched: 0, upserted: 0, skipped: 0, error: message };
    }
  },
});
