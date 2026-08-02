"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { rankProjects, type RankedProject } from "./lib/ranking";
import {
  DEFAULT_MODEL,
  buildNarrationContent,
  callOpenRouter,
  citedSlugs,
  fallbackReply,
  toRankingConstraints,
  toRankingItems,
  EXTRACTION_SYSTEM_PROMPT,
  NARRATION_SYSTEM_PROMPT,
  parseExtraction,
  type ChatMessage,
  type ExtractionKind,
  type NormalizedConstraints,
} from "./lib/plannerShared";
import { constraintsValidator, rankingValidator } from "./lib/validators";

/**
 * Grounded AI planner (non-streaming path; the chat UI streams via
 * src/app/api/planner/chat/route.ts). The LLM only (a) extracts constraints
 * into strict JSON and (b) narrates deterministic ranking results with
 * mandatory [slug] citations. It never answers project facts from memory.
 */

type SendMessageResult =
  | {
      ok: true;
      reply: string;
      constraints: NormalizedConstraints | null;
      rankings: ReturnType<typeof toRankingItems>;
      citedProjectSlugs: string[];
      sessionId: Id<"plannerSessions"> | null;
    }
  | { ok: false; error: string; reply: string };

export const sendMessage = action({
  args: {
    sessionId: v.optional(v.id("plannerSessions")),
    message: v.string(),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }),
      ),
    ),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      reply: v.string(),
      constraints: v.union(constraintsValidator, v.null()),
      rankings: v.array(rankingValidator),
      citedProjectSlugs: v.array(v.string()),
      sessionId: v.union(v.id("plannerSessions"), v.null()),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
      reply: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<SendMessageResult> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "planner_not_configured",
        reply:
          "The planner is not configured yet (missing model credentials). You can still browse and compare projects in the explorer.",
      };
    }

    const message = args.message.trim();
    if (!message) {
      return {
        ok: false as const,
        error: "empty_message",
        reply:
          "Tell me what you are looking for: budget, flat type, towns, or how long you can wait.",
      };
    }

    const transcript: ChatMessage[] = (args.history ?? [])
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    let kind: ExtractionKind = "constraints";
    let constraints: NormalizedConstraints | null = null;
    try {
      const extractionRaw = await callOpenRouter({
        apiKey,
        model,
        phase: "extract",
        json: true,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          ...transcript,
          { role: "user", content: message },
        ],
      });
      const parsed = parseExtraction(extractionRaw);
      kind = parsed.kind;
      constraints = parsed.constraints;
    } catch {
      // Extraction failed (timeout/5xx/parse): continue unconstrained.
      kind = "constraints";
      constraints = null;
    }

    // Fetched for chitchat too: the narration may only make coverage claims
    // it can see, so it always gets the real town list and project count.
    const allProjects = await ctx.runQuery(internal.planner.allForRanking, {});
    const townsCovered = [
      ...new Set(allProjects.map((p) => p.town).filter((t) => t.length > 0)),
    ].sort((a, b) => a.localeCompare(b));

    let top: RankedProject[] = [];
    if (kind === "constraints") {
      top = rankProjects(
        allProjects,
        constraints ? toRankingConstraints(constraints) : {},
      ).slice(0, 5);
    }

    let reply: string;
    try {
      reply = await callOpenRouter({
        apiKey,
        model,
        phase: "narrate",
        messages: [
          { role: "system", content: NARRATION_SYSTEM_PROMPT },
          ...transcript,
          {
            role: "user",
            content: buildNarrationContent({
              message,
              constraints,
              kind,
              top,
              todayISO: new Date().toISOString().slice(0, 10),
              totalProjects: allProjects.length,
              townsCovered,
            }),
          },
        ],
      });
    } catch {
      reply = fallbackReply(top);
    }

    const cited = citedSlugs(
      reply,
      top.map((entry) => entry.project.slug),
    );

    let sessionId: Id<"plannerSessions"> | null = null;
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      try {
        const userId = await ctx.runMutation(internal.users.ensureFromIdentity, {
          tokenIdentifier: identity.tokenIdentifier,
          clerkId: identity.subject,
          name: identity.name ?? undefined,
          email: identity.email ?? undefined,
        });
        sessionId = await ctx.runMutation(internal.planner.persistTurn, {
          userId,
          sessionId: args.sessionId ?? undefined,
          userMessage: message,
          assistantMessage: reply,
          constraints: constraints ?? undefined,
          citedProjectSlugs: cited,
        });
      } catch (error) {
        console.log(
          JSON.stringify({
            fn: "planner.sendMessage",
            phase: "persist",
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    return {
      ok: true as const,
      reply,
      constraints,
      rankings: toRankingItems(top),
      citedProjectSlugs: cited,
      sessionId,
    };
  },
});
