import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

import {
  AGENT_SYSTEM_PROMPT,
  DEFAULT_MODEL,
  normalizeConstraints,
} from "../../../../../convex/lib/plannerShared";
import { api } from "../../../../../convex/_generated/api";
import { createPlannerTools, createTurnCorpus, type TurnCorpus } from "@/lib/planner/tools";
import type { PlannerUIMessage } from "@/lib/planner/types";
import type { ProfileGeo } from "../../../../../convex/lib/profilePreferences";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Tool-calling planner. One LLM loop decides what it needs: read-only Convex
 * tools (search/detail/rank/resale/town/exercises) for governed data, Tavily
 * web search for everything else. The deterministic ranker still owns
 * recommendations; the model narrates. Post-stream verification checks every
 * cited slug and dollar figure against the union of this turn's tool results.
 */

async function authenticatedConvex(): Promise<{
  client: ConvexHttpClient;
  profileGeo?: ProfileGeo;
}> {
  const client = new ConvexHttpClient(
    process.env.NEXT_PUBLIC_CONVEX_URL ?? "",
  );
  try {
    const { userId, getToken, sessionClaims } = await auth();
    if (!userId) return { client };
    const token = await getToken(
      sessionClaims?.aud === "convex" ? undefined : { template: "convex" },
    );
    if (!token) return { client };
    client.setAuth(token);
    const profile = await client.query(api.profile.get, {});
    if (!profile) return { client };
    return {
      client,
      profileGeo: {
        workplaces: profile.workplaces.map((point, index) => ({
          label: `Workplace ${index + 1}`,
          lat: point.lat,
          lng: point.lng,
        })),
        ...(profile.parentsArea
          ? {
              parentsArea: {
                label: "Parents’ area",
                lat: profile.parentsArea.lat,
                lng: profile.parentsArea.lng,
              },
            }
          : {}),
      },
    };
  } catch {
    return { client };
  }
}

function messageText(message: PlannerUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

const FALLBACK_TEXT_ID = "fallback-text";

/**
 * Agent reply verification: cited slugs must have been returned by a tool
 * this turn; every S$ amount must be within 2% of a figure a tool returned
 * (tolerance absorbs the model's rounding without admitting inventions).
 * Month counts stay unverified: derived wait arithmetic is legitimate.
 */
function verifyAgentReply(reply: string, corpus: TurnCorpus): string[] {
  const violations: string[] = [];
  if (!corpus.ranked && corpus.slugs.size === 0) return violations;

  for (const match of reply.matchAll(/\[([a-z0-9][a-z0-9-]*)\]/g)) {
    if (!corpus.slugs.has(match[1])) {
      violations.push(`unknown_citation:${match[1]}`);
    }
  }

  const amounts = new Set<number>();
  for (const match of reply.matchAll(/S\$\s*([\d,]+(?:\.\d+)?)(k|m)?\b/gi)) {
    const raw = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const unit = match[2]?.toLowerCase();
    amounts.add(Math.round(unit === "k" ? raw * 1000 : unit === "m" ? raw * 1_000_000 : raw));
  }
  // Derived deltas ("S$30k cheaper") are legitimate arithmetic on corpus
  // figures; accept pairwise differences alongside the corpus itself.
  // Sub-80k figures are never project prices, so they skip the check.
  const known = [...corpus.amounts];
  const derived = new Set<number>();
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      derived.add(Math.abs(known[i]! - known[j]!));
    }
  }
  const within = (amount: number, target: number) =>
    Math.abs(target - amount) / Math.max(target, amount) <= 0.02;
  for (const amount of amounts) {
    if (amount < 80_000) continue;
    const near =
      known.some((k) => within(amount, k)) || [...derived].some((d) => within(amount, d));
    if (!near) violations.push(`unverified_amount:S$${amount}`);
  }
  return violations;
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages?: PlannerUIMessage[];
    priorConstraints?: unknown;
    requestGeneration?: unknown;
  };
  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUser ? messageText(lastUser) : "";
  // Constraint memory sent by the client; forwarded into the model's context
  // so multi-turn updates ("make it cheaper") keep earlier fields.
  const priorConstraints = normalizeConstraints(body.priorConstraints);
  const requestGeneration =
    typeof body.requestGeneration === "number" &&
    Number.isSafeInteger(body.requestGeneration) &&
    body.requestGeneration > 0
      ? body.requestGeneration
      : 0;
  const { client: convex, profileGeo } = await authenticatedConvex();

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const openrouter = createOpenRouter({ apiKey: apiKey ?? "" });

  const stream = createUIMessageStream<PlannerUIMessage>({
    onError: (error) => {
      console.error(
        "[planner/chat] stream error:",
        error instanceof Error ? error.message : error,
      );
      return "Something went wrong while preparing your answer.";
    },
    execute: async ({ writer }) => {
      if (!apiKey) {
        writer.write({ type: "text-start", id: FALLBACK_TEXT_ID });
        writer.write({
          type: "text-delta",
          id: FALLBACK_TEXT_ID,
          delta:
            "The planner is not configured yet (missing model credentials). You can still browse and compare projects in the explorer.",
        });
        writer.write({ type: "text-end", id: FALLBACK_TEXT_ID });
        return;
      }
      if (!userText) {
        writer.write({ type: "text-start", id: FALLBACK_TEXT_ID });
        writer.write({
          type: "text-delta",
          id: FALLBACK_TEXT_ID,
          delta:
            "Tell me what you are looking for: budget, flat type, towns, or how long you can wait.",
        });
        writer.write({ type: "text-end", id: FALLBACK_TEXT_ID });
        return;
      }

      const prior = messages.slice(0, -1).slice(-8);
      const transcriptModel = await convertToModelMessages(prior);

      const todayISO = new Date().toISOString().slice(0, 10);
      const corpus = createTurnCorpus();
      // Figures the user supplied themselves are grounded by definition:
      // quoting "your S$500k budget" back must not fail the amount check.
      if (typeof priorConstraints?.budgetMax === "number" && priorConstraints.budgetMax > 0) {
        corpus.amounts.add(priorConstraints.budgetMax);
      }
      const tools = createPlannerTools({
        convex,
        writer,
        corpus,
        tavilyApiKey: process.env.TAVILY_API_KEY,
        signal: req.signal,
        todayISO,
        profileGeo,
        requestGeneration,
      });

      writer.write({
        type: "data-phase",
        data: {
          phase: "reading",
          label: "Reading your situation",
          generation: requestGeneration,
        },
        transient: true,
      });

      const memoryNote = priorConstraints
        ? `\n\nConstraints so far: ${JSON.stringify(priorConstraints)}\nIf this message updates them, pass the FULL updated set to the tool: keep fields not mentioned; clear a field only when the user explicitly removes it.`
        : "";

      const result = streamText({
        model: openrouter.chat(model),
        providerOptions: {
          // Keep the model's scratchpad out of the stream: first visible
          // token arrives sooner and no half-formed reasoning leaks into UI.
          openrouter: { reasoning: { exclude: true, effort: "low" } },
        },
        system: `${AGENT_SYSTEM_PROMPT}\n\nToday's date: ${todayISO}.`,
        messages: [
          ...transcriptModel,
          { role: "user" as const, content: userText + memoryNote },
        ],
        tools,
        stopWhen: stepCountIs(5),
        abortSignal: req.signal,
        temperature: 0.1,
        onStepFinish: (step) => {
          if (step.toolCalls.length > 0) {
            writer.write({
              type: "data-phase",
              data: {
                phase: "writing",
                label: "Writing your answer",
                generation: requestGeneration,
              },
              transient: true,
            });
          }
        },
      });
      // Text streams through as it is generated; cards/chips were already
      // written by the tools but the client gates them on text presence.
      for await (const chunk of result.toUIMessageStream<PlannerUIMessage>()) {
        writer.write(chunk);
      }

      // Post-stream integrity check against the union of tool results.
      let fullText = "";
      try {
        fullText = await result.text;
      } catch {
        fullText = "";
      }
      if (fullText.trim().length > 0) {
        const violations = verifyAgentReply(fullText, corpus);
        if (violations.length > 0) {
          console.warn(
            JSON.stringify({ fn: "planner", phase: "verify", violations }),
          );
          writer.write({
            type: "data-replaceText",
            data: {
              text:
                corpus.fallbackText ??
                "I could not verify that answer against our records, so I have replaced it. Try narrowing the question, or set an alert below and we will let you know when a matching launch appears.",
              reason: "citation-check",
              generation: requestGeneration,
            },
          });
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
