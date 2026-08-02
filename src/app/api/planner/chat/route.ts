import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ConvexHttpClient } from "convex/browser";

import { api } from "../../../../../convex/_generated/api";
import { rankProjects, type RankedProject } from "../../../../../convex/lib/ranking";
import {
  DEFAULT_MODEL,
  EXTRACTION_SYSTEM_PROMPT,
  NARRATION_SYSTEM_PROMPT,
  buildNarrationContent,
  buildSuggestions,
  callOpenRouter,
  extractionJsonSchema,
  extractionSchema,
  extractJsonObject,
  fallbackReply,
  isSchemaModeUnsupported,
  normalizeConstraints,
  parseExtraction,
  toRankingConstraints,
  toRankingItems,
  verifyNarration,
  type ChatMessage,
  type NarrationNoMatch,
  type NormalizedConstraints,
} from "../../../../../convex/lib/plannerShared";
import type { PlannerUIMessage } from "@/lib/planner/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Streaming planner pipeline. Same guardrails as the Convex action path:
 * constraint extraction (strict JSON), deterministic ranking over governed
 * Convex data, then a streamed narration that may only cite [slug]s from
 * the ranked records. Progress phases stream as transient data parts so the
 * UI can show "Searching…" instead of a silent spinner.
 */

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");

function messageText(message: PlannerUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

const FALLBACK_TEXT_ID = "fallback-text";

/**
 * Extraction is the planner's ears. If it fails or returns nothing usable we
 * must not rank on empty constraints: every project then scores a neutral 52
 * and the top-5 is alphabetical noise presented as recommendations. Retry
 * once, then give up honestly with a deterministic clarifying reply.
 */
type ExtractionOutcome =
  | { kind: "chitchat"; constraints: NormalizedConstraints | null }
  | { kind: "constraints"; constraints: NormalizedConstraints };

const EXTRACTION_ATTEMPTS = [
  { attempt: 1, timeoutMs: 20_000 },
  { attempt: 2, timeoutMs: 25_000 },
] as const;

type SchemaValidation =
  | { ok: true; outcome: ExtractionOutcome }
  | { ok: false; error: string };

/**
 * Strict-mode path: the reply must be a JSON object that satisfies the
 * extraction schema, then normalizeConstraints sanitizes it (belt and
 * braces). A constraints read with every field empty is worthless for
 * ranking, so it is reported as a failure and retried.
 */
function validateExtraction(raw: string): SchemaValidation {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "empty_or_unparseable_extraction" };
  }
  const result = extractionSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ")
      .slice(0, 300);
    return { ok: false, error: `schema_validation: ${issues}` };
  }
  const constraints = normalizeConstraints(result.data);
  if (result.data.kind === "chitchat") {
    return { ok: true, outcome: { kind: "chitchat", constraints } };
  }
  if (constraints === null) {
    return { ok: false, error: "empty_or_unparseable_extraction" };
  }
  return { ok: true, outcome: { kind: "constraints", constraints } };
}

async function extractWithRetry(opts: {
  apiKey: string;
  model: string;
  transcript: ChatMessage[];
  userText: string;
  priorConstraints: NormalizedConstraints | null;
}): Promise<ExtractionOutcome | null> {
  const baseUserContent = opts.priorConstraints
    ? `${opts.userText}\n\nHere are the constraints so far: ${JSON.stringify(
        opts.priorConstraints,
      )}\nOutput the FULL updated object after applying the new message; keep fields not mentioned; set a field to null only if the user explicitly removes it.`
    : opts.userText;

  let schemaMode = true;
  let repairNote: string | null = null;

  for (const { attempt, timeoutMs } of EXTRACTION_ATTEMPTS) {
    const userContent = repairNote
      ? `${baseUserContent}\n\nYour previous reply failed validation (${repairNote}). Return corrected JSON only.`
      : baseUserContent;
    try {
      const raw = await callOpenRouter({
        apiKey: opts.apiKey,
        model: opts.model,
        phase: "extract",
        timeoutMs,
        ...(schemaMode
          ? {
              jsonSchema: {
                name: "planner_constraints",
                schema: extractionJsonSchema,
              },
            }
          : { json: true }),
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          ...opts.transcript,
          { role: "user", content: userContent },
        ],
      });
      if (schemaMode) {
        const validation = validateExtraction(raw);
        if (validation.ok) return validation.outcome;
        console.warn(
          JSON.stringify({
            fn: "planner",
            phase: "extract",
            attempt,
            error: validation.error,
          }),
        );
        // Self-heal: the next attempt carries the validation error.
        repairNote = validation.error;
        continue;
      }
      const parsed = parseExtraction(raw);
      if (parsed.kind === "chitchat") {
        return { kind: "chitchat", constraints: parsed.constraints };
      }
      if (parsed.constraints !== null) {
        return { kind: "constraints", constraints: parsed.constraints };
      }
      // parseExtraction folds unparseable JSON into "constraints" + null, the
      // same shape as a genuinely empty read; both are worthless for ranking.
      console.warn(
        JSON.stringify({
          fn: "planner",
          phase: "extract",
          attempt,
          error: "empty_or_unparseable_extraction",
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        JSON.stringify({
          fn: "planner",
          phase: "extract",
          attempt,
          error: message,
        }),
      );
      repairNote = null;
      if (schemaMode && isSchemaModeUnsupported(message)) {
        // The provider cannot honor strict json_schema: downgrade to
        // json_object for the remaining attempt.
        schemaMode = false;
      }
    }
  }
  return null;
}

const CLARIFYING_REPLY =
  "I didn't quite catch that. Give me a budget, the towns you are looking at, flat types, or how long you can wait, and I will rank the launches for you.";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages?: PlannerUIMessage[];
    priorConstraints?: unknown;
  };
  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUser ? messageText(lastUser) : "";
  // Constraint memory sent by the client; sanitized before the model sees it.
  const priorConstraints = normalizeConstraints(body.priorConstraints);

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
        writer.write({
          type: "text-start",
          id: FALLBACK_TEXT_ID,
        });
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
      const transcriptText: ChatMessage[] = prior
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: messageText(m),
        }))
        .filter((m) => m.content.length > 0);
      const transcriptModel = await convertToModelMessages(prior);

      writer.write({
        type: "data-phase",
        data: { phase: "reading", label: "Reading your situation" },
        transient: true,
      });

      // With constraint memory the extractor only needs the newest exchange
      // to apply the update; without it the fuller transcript is the memory.
      const extraction = await extractWithRetry({
        apiKey,
        model,
        transcript: priorConstraints ? transcriptText.slice(-2) : transcriptText,
        userText,
        priorConstraints,
      });

      if (extraction === null) {
        // No usable read of the message: skip ranking and answer with a
        // deterministic clarifying reply (no LLM call, cannot hallucinate).
        writer.write({
          type: "data-constraints",
          id: "constraints",
          data: { constraints: null },
        });
        writer.write({ type: "text-start", id: FALLBACK_TEXT_ID });
        writer.write({
          type: "text-delta",
          id: FALLBACK_TEXT_ID,
          delta: CLARIFYING_REPLY,
        });
        writer.write({ type: "text-end", id: FALLBACK_TEXT_ID });
        return;
      }

      const { kind, constraints } = extraction;

      writer.write({
        type: "data-constraints",
        id: "constraints",
        data: { constraints },
      });

      if (kind === "constraints") {
        writer.write({
          type: "data-phase",
          data: { phase: "searching", label: "Searching the launch records" },
          transient: true,
        });
      }

      // Fetched for chitchat too: the narration may only make coverage claims
      // it can see, so it always gets the real town list and project count.
      const all = await convex.query(api.planner.forRanking, {});
      const totalProjects = all.length;
      const townsCovered = [
        ...new Set(all.map((p) => p.town).filter((t) => t.length > 0)),
      ].sort((a, b) => a.localeCompare(b));

      let top: RankedProject[] = [];
      let noMatch: NarrationNoMatch | undefined;
      if (kind === "constraints") {
        writer.write({
          type: "data-phase",
          data: {
            phase: "ranking",
            label: `Scoring ${all.length} projects against your constraints`,
          },
          transient: true,
        });
        const ranked = rankProjects(all, toRankingConstraints(constraints));
        top = ranked.slice(0, 5);

        const requestedTowns = constraints.towns ?? [];
        const requestedRegions = constraints.regions ?? [];
        if (requestedTowns.length > 0) {
          const wantedTowns = new Set(
            requestedTowns.map((t) => t.toLowerCase()),
          );
          const townHits = all.filter((p) =>
            wantedTowns.has(p.town.toLowerCase()),
          );
          if (townHits.length === 0) {
            // Zero projects in the requested towns: the unconstrained top-5
            // must not be presented as if it answered the question.
            const wantedRegions = new Set(
              requestedRegions.map((r) => r.toLowerCase()),
            );
            const neighbours =
              wantedRegions.size > 0
                ? ranked.filter((entry) =>
                    wantedRegions.has(entry.project.region.toLowerCase()),
                  )
                : [];
            if (neighbours.length > 0) {
              top = neighbours.slice(0, 3);
              noMatch = {
                scope: "towns",
                requested: requestedTowns,
                suggestionMode: "region-neighbours",
              };
            } else {
              top = [];
              noMatch = {
                scope: "towns",
                requested: requestedTowns,
                suggestionMode: "none",
              };
            }
          }
        } else if (requestedRegions.length > 0) {
          const wantedRegions = new Set(
            requestedRegions.map((r) => r.toLowerCase()),
          );
          const regionHits = all.filter((p) =>
            wantedRegions.has(p.region.toLowerCase()),
          );
          if (regionHits.length === 0) {
            top = [];
            noMatch = {
              scope: "regions",
              requested: requestedRegions,
              suggestionMode: "none",
            };
          }
        }
      }

      // Trust denominators for the cards and the narration prompt.
      const matchesInRequestedTowns =
        constraints !== null && (constraints.towns?.length ?? 0) > 0
          ? all.filter((p) =>
              constraints.towns!.some(
                (t) => t.toLowerCase() === p.town.toLowerCase(),
              ),
            ).length
          : 0;
      const updatedAtBySlug = new Map(all.map((p) => [p.slug, p.updatedAt]));
      const rankedUpdatedAts = top
        .map((entry) => updatedAtBySlug.get(entry.project.slug))
        .filter((value): value is number => typeof value === "number");
      const dataAsOf =
        rankedUpdatedAts.length > 0
          ? new Date(Math.max(...rankedUpdatedAts)).toISOString().slice(0, 10)
          : undefined;

      writer.write({
        type: "data-phase",
        data: { phase: "writing", label: "Writing your answer" },
        transient: true,
      });

      const todayISO = new Date().toISOString().slice(0, 10);
      const result = streamText({
        model: openrouter.chat(model),
        providerOptions: {
          // Keep the model's scratchpad out of the stream: first visible
          // token arrives sooner and no half-formed reasoning leaks into UI.
          openrouter: { reasoning: { exclude: true, effort: "low" } },
        },
        system: NARRATION_SYSTEM_PROMPT,
        messages: [
          ...transcriptModel,
          {
            role: "user" as const,
            content: buildNarrationContent({
              message: userText,
              constraints,
              kind,
              top,
              todayISO,
              totalProjects,
              townsCovered,
              noMatch,
              matchesInRequestedTowns,
            }),
          },
        ],
        temperature: 0.1,
      });
      // Narration text streams FIRST; the cards and follow-up chips are
      // written only after it completes so they never race ahead of it.
      for await (const chunk of result.toUIMessageStream<PlannerUIMessage>()) {
        writer.write(chunk);
      }

      // Post-stream integrity check: citations must resolve to ranked slugs,
      // and every stated S$ amount / month count must exist in the records
      // the model was given. Chitchat replies have no records, so skip it.
      if (kind === "constraints") {
        let fullText = "";
        try {
          fullText = await result.text;
        } catch {
          fullText = "";
        }
        if (fullText.trim().length > 0) {
          const violations = verifyNarration(fullText, top, {
            constraints,
            todayISO,
          });
          if (violations.length > 0) {
            console.warn(
              JSON.stringify({ fn: "planner", phase: "verify", violations }),
            );
            writer.write({
              type: "data-replaceText",
              data: {
                text:
                  top.length > 0
                    ? fallbackReply(top)
                    : "I could not verify that answer against our launch records, so I have replaced it. Our records have no matching projects for that request yet; set an alert below and we will let you know when a new launch appears.",
                reason: "citation-check",
              },
            });
          }
        }
      }

      if (top.length > 0) {
        writer.write({
          type: "data-rankings",
          id: "rankings",
          data: {
            rankings: toRankingItems(top),
            totalProjects,
            ...(dataAsOf ? { dataAsOf } : {}),
          },
        });
      }

      const suggestions = buildSuggestions({ kind, constraints, top, noMatch });
      if (suggestions.length > 0) {
        writer.write({
          type: "data-suggestions",
          id: "suggestions",
          data: { suggestions },
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
