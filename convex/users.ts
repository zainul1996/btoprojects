import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { authedMutation } from "./lib/auth";
import { userValidator } from "./lib/validators";

export const current = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});

/**
 * Create the local users row from the Clerk identity on first use; refresh
 * display fields on subsequent calls. Safe to call on every sign-in.
 */
export const upsertCurrent = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    const fields = {
      clerkId: identity.subject,
      name: identity.name ?? undefined,
      email: identity.email ?? undefined,
    };

    if (existing) {
      await ctx.db.patch("users", existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      ...fields,
    });
  },
});

export const setTelegramChatId = authedMutation({
  args: { chatId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("users", ctx.user._id, { telegramChatId: args.chatId });
    return null;
  },
});

/** Internal helpers for actions (planner persistence, telegram delivery). */

export const byToken = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
  },
});

export const getById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get("users", args.userId);
  },
});

export const ensureFromIdentity = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    clerkId: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("users", {
      tokenIdentifier: args.tokenIdentifier,
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
    });
  },
});
