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
  callOpenRouter,
  parseExtraction,
  toRankingConstraints,
  toRankingItems,
  type ChatMessage,
  type ExtractionKind,
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

export async function POST(req: Request) {
  const body = (await req.json()) as { messages?: PlannerUIMessage[] };
  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUser ? messageText(lastUser) : "";

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

      let kind: ExtractionKind = "constraints";
      let constraints: NormalizedConstraints | null = null;
      try {
        const extractionRaw = await callOpenRouter({
          apiKey,
          model,
          phase: "extract",
          json: true,
          timeoutMs: 20_000,
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            ...transcriptText,
            { role: "user", content: userText },
          ],
        });
        const parsed = parseExtraction(extractionRaw);
        kind = parsed.kind;
        constraints = parsed.constraints;
      } catch {
        // Extraction failed: continue unconstrained rather than erroring.
      }

      writer.write({
        type: "data-constraints",
        data: { constraints },
      });

      let top: RankedProject[] = [];
      if (kind === "constraints") {
        writer.write({
          type: "data-phase",
          data: { phase: "searching", label: "Searching the launch records" },
          transient: true,
        });
        const all = await convex.query(api.planner.forRanking, {});
        writer.write({
          type: "data-phase",
          data: {
            phase: "ranking",
            label: `Scoring ${all.length} projects against your constraints`,
          },
          transient: true,
        });
        top = rankProjects(
          all,
          constraints ? toRankingConstraints(constraints) : {},
        ).slice(0, 5);
        if (top.length > 0) {
          writer.write({
            type: "data-rankings",
            data: { rankings: toRankingItems(top) },
          });
        }
      }

      writer.write({
        type: "data-phase",
        data: { phase: "writing", label: "Writing your answer" },
        transient: true,
      });

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
            }),
          },
        ],
        temperature: 0.2,
      });
      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
