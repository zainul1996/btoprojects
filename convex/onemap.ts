"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

/**
 * OneMap (SLA) adapter. Token TTL is 72h with no auto-renew, so we cache it
 * in the kv table with a 12h safety margin and refresh lazily on 401.
 * Endpoints used: auth/getToken + common/elastic/search (geocoding).
 * No bulk geocoding runs yet — this exists for V1 commute + future use.
 */

const TOKEN_KEY = "onemap_token";
const TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const REFRESH_MARGIN_MS = 12 * 60 * 60 * 1000; // refresh if expiring within 12h

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
    throw new Error(`OneMap getToken failed: HTTP ${res.status} ${text.slice(0, 200)}`);
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

async function ensureToken(
  ctx: ActionCtx,
  forceRefresh = false,
): Promise<string> {
  if (!forceRefresh) {
    const cached = await ctx.runQuery(internal.kvStore.get, { key: TOKEN_KEY });
    if (
      cached &&
      cached.expiresAt !== undefined &&
      cached.expiresAt - REFRESH_MARGIN_MS > Date.now()
    ) {
      return cached.value;
    }
  }
  const { token, expiresAt } = await requestNewToken();
  await ctx.runMutation(internal.kvStore.set, {
    key: TOKEN_KEY,
    value: token,
    expiresAt,
  });
  return token;
}

interface GetTokenResult {
  ok: boolean;
  refreshed: boolean;
  expiresAt?: number;
  error?: string;
}

export const getToken = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    refreshed: v.boolean(),
    expiresAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<GetTokenResult> => {
    try {
      const cached = await ctx.runQuery(internal.kvStore.get, { key: TOKEN_KEY });
      if (
        cached &&
        cached.expiresAt !== undefined &&
        cached.expiresAt - REFRESH_MARGIN_MS > Date.now()
      ) {
        return { ok: true, refreshed: false, expiresAt: cached.expiresAt };
      }
      const { token, expiresAt } = await requestNewToken();
      await ctx.runMutation(internal.kvStore.set, {
        key: TOKEN_KEY,
        value: token,
        expiresAt,
      });
      console.log(JSON.stringify({ fn: "onemap.getToken", refreshed: true, expiresAt }));
      return { ok: true, refreshed: true, expiresAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify({ fn: "onemap.getToken", ok: false, error: message }));
      return { ok: false, refreshed: false, error: message };
    }
  },
});

interface SearchResponse {
  found?: number;
  results?: {
    ADDRESS?: string;
    LATITUDE?: string;
    LONGITUDE?: string;
    POSTAL?: string;
    BUILDING?: string;
  }[];
}

async function elasticSearch(address: string, token: string) {
  const params = new URLSearchParams({
    searchVal: address,
    returnGeom: "Y",
    getAddrDetails: "y",
    pageNum: "1",
  });
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: token },
  });
  return res;
}

type GeocodeResult =
  | {
      ok: true;
      found: boolean;
      lat?: number;
      lng?: number;
      address?: string;
      postal?: string;
    }
  | { ok: false; error: string };

export const geocode = internalAction({
  args: { address: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      found: v.boolean(),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      address: v.optional(v.string()),
      postal: v.optional(v.string()),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args): Promise<GeocodeResult> => {
    try {
      let token = await ensureToken(ctx);
      let res = await elasticSearch(args.address, token);
      if (res.status === 401) {
        // Token rejected early — refresh once and retry.
        token = await ensureToken(ctx, true);
        res = await elasticSearch(args.address, token);
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OneMap search failed: HTTP ${res.status} ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as SearchResponse;
      const top = data.results?.[0];
      if (!top || !top.LATITUDE || !top.LONGITUDE) {
        return { ok: true as const, found: false };
      }
      return {
        ok: true as const,
        found: true,
        lat: Number(top.LATITUDE),
        lng: Number(top.LONGITUDE),
        address: top.ADDRESS,
        postal: top.POSTAL,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
