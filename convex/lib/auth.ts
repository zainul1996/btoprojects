import { customMutation, customQuery } from "convex-helpers/server/customFunctions";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/**
 * Auth helpers + custom-function wrappers (Convex's RLS equivalent).
 * Every public function touching user data should use authedQuery /
 * authedMutation so the identity check lives in exactly one place.
 */

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    // Client must call users.upsertCurrent once after sign-in.
    throw new Error("User not found");
  }
  return user;
}

export async function getCurrentUserOrNull(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});
