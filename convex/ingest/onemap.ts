import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { emptySummary, INGEST_JOBS, type IngestRunSummary } from "./types";

/**
 * OneMap (SLA) geocoding ingestion for BTO projects (Track W1).
 *
 * Scope: fill missing project coordinates and catch coordinate drift — not
 * bulk re-geocoding. Projects whose coords exist AND sit near their town's
 * seeded centre (local lookup, no API call) are skipped entirely.
 *
 * Runtime note: this file intentionally does NOT use "use node" — Convex only
 * allows actions in node files, and this module bundles an internalQuery and
 * an internalMutation alongside the action. Everything here (fetch,
 * URLSearchParams, setTimeout) runs in the default Convex runtime.
 *
 * Token handling: OneMap tokens live 72h with no auto-renew. Order per run:
 * kv cache → env ONEMAP_TOKEN (bootstrap) → on 401/"token expired" re-auth
 * via ONEMAP_EMAIL/ONEMAP_PASSWORD and cache the fresh token in kv.
 *
 * Token cache is SHARED with the legacy runtime geocoder (convex/onemap.ts):
 * both read/write the legacy kv row "onemap_token" in the legacy format
 * (value = bare token string, expiry in the row's expiresAt field) via
 * internal.kvStore — so the 02:30 SGT token-refresh cron warms this crawler
 * too, and a token refreshed here serves the live site. (Integration choice:
 * adapt this module to the legacy key rather than dual-key writes — one
 * cache, no format drift; the pre-integration "onemap.token" JSON key is
 * abandoned.)
 */

const TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const KV_TOKEN_KEY = "onemap_token"; // shared with convex/onemap.ts — do not rename
const TOKEN_REFRESH_MARGIN_MS = 12 * 60 * 60 * 1000;
const REQUEST_GAP_MS = 150;
/** ~220m — beyond this the seed coords win and we record a conflict note. */
const COORD_TOLERANCE_DEG = 0.002;
/** ~5.5km — "town lookup matches": project coords sit inside their town. */
const TOWN_MATCH_TOLERANCE_DEG = 0.05;
const MAX_ERRORS_KEPT = 50;

export const listProjects = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      name: v.string(),
      slug: v.string(),
      town: v.string(),
      townLat: v.number(),
      townLng: v.number(),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    // Bounded admin table (seeded launches only) — collect is appropriate.
    const projects = await ctx.db.query("projects").collect();
    const rows = [];
    for (const project of projects) {
      const town = await ctx.db.get("towns", project.townId);
      if (!town) continue;
      rows.push({
        _id: project._id,
        name: project.name,
        slug: project.slug,
        town: town.name,
        townLat: town.lat,
        townLng: town.lng,
        lat: project.lat,
        lng: project.lng,
      });
    }
    return rows;
  },
});

export const applyGeocode = internalMutation({
  args: {
    projectId: v.id("projects"),
    lat: v.number(),
    lng: v.number(),
    sourceId: v.id("sources"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("projects", args.projectId, {
      lat: args.lat,
      lng: args.lng,
      updatedAt: Date.now(),
    });
    return null;
  },
});

interface TokenResponse {
  access_token?: string;
  expiry_timestamp?: string; // unix seconds, as string
}

async function requestNewToken(): Promise<{ token: string; expiresAt: number }> {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) {
    throw new Error("ONEMAP_EMAIL/ONEMAP_PASSWORD not set on deployment");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `OneMap getToken failed: HTTP ${res.status} ${text.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token || !data.expiry_timestamp) {
    throw new Error("OneMap getToken returned malformed payload");
  }
  return {
    token: data.access_token,
    expiresAt: Number(data.expiry_timestamp) * 1000,
  };
}

async function refreshToken(ctx: ActionCtx): Promise<string> {
  const { token, expiresAt } = await requestNewToken();
  // Legacy kv format (bare token + row expiresAt) — shared with the site.
  await ctx.runMutation(internal.kvStore.set, {
    key: KV_TOKEN_KEY,
    value: token,
    expiresAt,
  });
  return token;
}

async function ensureToken(ctx: ActionCtx, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = await ctx.runQuery(internal.kvStore.get, {
      key: KV_TOKEN_KEY,
    });
    if (
      cached &&
      cached.expiresAt !== undefined &&
      cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()
    ) {
      return cached.value;
    }
    const envToken = process.env.ONEMAP_TOKEN;
    if (envToken) return envToken;
  }
  return await refreshToken(ctx);
}

interface OneMapSearchResponse {
  found?: number;
  totalNumFound?: number;
  pageNum?: number;
  results?: {
    ADDRESS?: string;
    LATITUDE?: string;
    LONGITUDE?: string;
    POSTAL?: string;
    BUILDING?: string;
  }[];
  error?: string;
}

function isAuthError(status: number, data: OneMapSearchResponse | null): boolean {
  if (status === 401) return true;
  return typeof data?.error === "string" && /token|auth/i.test(data.error);
}

/** Global auth failures abort the run (job → failed), unlike per-project errors. */
class OneMapAuthError extends Error {}

interface GeocodeHit {
  lat: number;
  lng: number;
  address?: string;
  query: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const runSummaryValidator = v.object({
  jobName: v.string(),
  rowsFetched: v.number(),
  rowsWritten: v.number(),
  factsInserted: v.number(),
  factsUnchanged: v.number(),
  factsConflicts: v.number(),
  errors: v.array(v.string()),
});

export const run = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    summary: runSummaryValidator,
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const summary: IngestRunSummary = emptySummary(INGEST_JOBS.geocode);
    const jobId = await ctx.runMutation(internal.ingest.lib.startJob, {
      source: INGEST_JOBS.geocode,
    });
    try {
      const sourceId = await ctx.runMutation(internal.ingest.lib.upsertSource, {
        url: SEARCH_URL,
        kind: "onemap",
        publisher: "SLA OneMap",
        title: "OneMap elastic search (geocoding)",
      });

      const projects = await ctx.runQuery(
        internal.ingest.onemap.listProjects,
        {},
      );
      summary.rowsFetched = projects.length;

      let token = await ensureToken(ctx);
      let refreshed = false;
      let lastRequestAt = 0;
      let skippedFresh = 0;
      let geocoded = 0;
      let conflicts = 0;
      let notFound = 0;

      const search = async (
        query: string,
      ): Promise<{ status: number; data: OneMapSearchResponse | null }> => {
        const wait = REQUEST_GAP_MS - (Date.now() - lastRequestAt);
        if (wait > 0) await sleep(wait);
        const params = new URLSearchParams({
          searchVal: query,
          returnGeom: "Y",
          getAddrDetails: "Y",
          pageNum: "1",
        });
        const res = await fetch(`${SEARCH_URL}?${params}`, {
          headers: { Authorization: token },
        });
        lastRequestAt = Date.now();
        const data = (await res.json().catch(() => null)) as
          | OneMapSearchResponse
          | null;
        if (isAuthError(res.status, data)) {
          if (refreshed) {
            throw new OneMapAuthError(
              "OneMap rejected a freshly re-authenticated token; aborting run",
            );
          }
          refreshed = true;
          try {
            token = await refreshToken(ctx);
          } catch (error) {
            throw new OneMapAuthError(
              error instanceof Error ? error.message : String(error),
            );
          }
          return await search(query);
        }
        return { status: res.status, data };
      };

      const recordFact = async (
        projectId: Id<"projects">,
        field: "lat" | "lng",
        value: number,
        note?: string,
      ) => {
        const result = await ctx.runMutation(
          internal.ingest.lib.applyProjectFact,
          {
            projectId,
            field,
            value: String(value),
            confidence: "official",
            extractionMethod: "parser",
            sourceId,
            ...(note !== undefined ? { note } : {}),
          },
        );
        if (result === "inserted") summary.factsInserted++;
        else if (result === "unchanged") summary.factsUnchanged++;
        else summary.factsConflicts++;
      };

      const pushError = (message: string) => {
        if (summary.errors.length < MAX_ERRORS_KEPT) {
          summary.errors.push(message);
        }
      };

      for (const project of projects) {
        try {
          // Shell projects carry placeholder 0,0 coordinates (the schema
          // requires numbers) — treat near-zero as "no coords" so shells
          // get real/town-fallback geocodes applied instead of being
          // recorded as conflicts against the placeholder.
          const hasCoords =
            typeof project.lat === "number" &&
            typeof project.lng === "number" &&
            !(Math.abs(project.lat) < 0.01 && Math.abs(project.lng) < 0.01);
          const townMatches =
            hasCoords &&
            Math.abs(project.lat! - project.townLat) <=
              TOWN_MATCH_TOLERANCE_DEG &&
            Math.abs(project.lng! - project.townLng) <=
              TOWN_MATCH_TOLERANCE_DEG;
          if (townMatches) {
            skippedFresh++;
            continue;
          }

          // Strategy chain: the projects table has no address field, so the
          // "address if present" tier is a no-op → name + "BTO" → town name.
          const strategies = [`${project.name} BTO`, project.town];
          let hit: GeocodeHit | null = null;
          for (const query of strategies) {
            const { status, data } = await search(query);
            if (status !== 200 || !data) {
              pushError(
                `${project.slug}: search "${query}" HTTP ${status}` +
                  (data?.error ? ` (${data.error})` : ""),
              );
              continue;
            }
            const top = data.results?.[0];
            if (
              (data.found ?? 0) > 0 &&
              top?.LATITUDE &&
              top?.LONGITUDE &&
              Number.isFinite(Number(top.LATITUDE)) &&
              Number.isFinite(Number(top.LONGITUDE))
            ) {
              hit = {
                lat: Number(top.LATITUDE),
                lng: Number(top.LONGITUDE),
                address: top.ADDRESS,
                query,
              };
              break;
            }
          }

          if (!hit) {
            notFound++;
            pushError(`${project.slug}: no OneMap result for any strategy`);
            continue;
          }
          geocoded++;

          const viaTownFallback = hit.query === project.town;
          const noteBase = `OneMap "${hit.query}" → ${hit.address ?? "no address"}`;

          if (!hasCoords) {
            await ctx.runMutation(internal.ingest.onemap.applyGeocode, {
              projectId: project._id,
              lat: hit.lat,
              lng: hit.lng,
              sourceId,
              note:
                noteBase +
                (viaTownFallback ? " (town-centre precision)" : ""),
            });
            const patchNote = viaTownFallback
              ? `${noteBase} (town-centre precision)`
              : noteBase;
            await recordFact(project._id, "lat", hit.lat, patchNote);
            await recordFact(project._id, "lng", hit.lng, patchNote);
            summary.rowsWritten++;
            continue;
          }

          const dLat = Math.abs(hit.lat - project.lat!);
          const dLng = Math.abs(hit.lng - project.lng!);
          if (dLat > COORD_TOLERANCE_DEG || dLng > COORD_TOLERANCE_DEG) {
            conflicts++;
            const conflictNote =
              `conflict: kept stored coords (${project.lat}, ${project.lng}); ` +
              `${noteBase} differs by dLat=${dLat.toFixed(5)} dLng=${dLng.toFixed(5)} deg ` +
              `(>${COORD_TOLERANCE_DEG} tolerance) — seed site-centroid may be more precise`;
            await recordFact(project._id, "lat", hit.lat, conflictNote);
            await recordFact(project._id, "lng", hit.lng, conflictNote);
          }
          // Within tolerance → skip silently (seed coords confirmed fresh).
        } catch (error) {
          if (error instanceof OneMapAuthError) throw error;
          pushError(
            `${project.slug}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      await ctx.runMutation(internal.ingest.lib.finishJob, {
        jobId,
        status: "success",
        stats: summary,
      });
      console.log(
        JSON.stringify({
          fn: "ingest.onemap.run",
          ...summary,
          skippedFresh,
          geocoded,
          conflicts,
          notFound,
          tokenRefreshed: refreshed,
        }),
      );
      return { ok: true, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(message);
      await ctx.runMutation(internal.ingest.lib.finishJob, {
        jobId,
        status: "failed",
        stats: summary,
        error: message,
      });
      console.log(
        JSON.stringify({ fn: "ingest.onemap.run", ok: false, error: message }),
      );
      return { ok: false, summary, error: message };
    }
  },
});
