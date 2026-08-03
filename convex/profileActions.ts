"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import {
  isSingaporeCoordinate,
  PROFILE_LIMITS,
} from "./lib/profilePreferences";

const addressMatchValidator = v.object({
  address: v.string(),
  lat: v.number(),
  lng: v.number(),
});

type ResolveResult =
  | {
      ok: true;
      match: { address: string; lat: number; lng: number };
    }
  | {
      ok: false;
      reason: "not_found" | "unavailable" | "rate_limited";
    };

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

export const resolveSingaporeAddress = action({
  args: { address: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      match: addressMatchValidator,
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(
        v.literal("not_found"),
        v.literal("unavailable"),
        v.literal("rate_limited"),
      ),
    }),
  ),
  handler: async (
    ctx: ActionCtx,
    args: { address: string },
  ): Promise<ResolveResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const address = args.address.trim().replace(/\s+/g, " ");
    if (
      address.length < PROFILE_LIMITS.labelMin ||
      address.length > PROFILE_LIMITS.labelMax
    ) {
      return { ok: false, reason: "not_found" };
    }

    try {
      const allowed = await ctx.runMutation(
        internal.profileRateLimit.consumeGeocode,
        {
          tokenIdentifier: identity.tokenIdentifier,
          now: Date.now(),
        },
      );
      if (!allowed) {
        return { ok: false, reason: "rate_limited" };
      }
      const result: GeocodeResult = await ctx.runAction(
        internal.onemap.geocode,
        { address },
      );
      if (!result.ok) return { ok: false as const, reason: "unavailable" as const };
      if (
        !result.found ||
        !result.address ||
        result.lat === undefined ||
        result.lng === undefined
      ) {
        return { ok: false as const, reason: "not_found" as const };
      }
      if (!isSingaporeCoordinate(result.lat, result.lng)) {
        return { ok: false as const, reason: "not_found" as const };
      }
      return {
        ok: true as const,
        match: {
          address: result.address.trim().replace(/\s+/g, " ").slice(0, 120),
          lat: result.lat,
          lng: result.lng,
        },
      };
    } catch {
      return { ok: false as const, reason: "unavailable" as const };
    }
  },
});
