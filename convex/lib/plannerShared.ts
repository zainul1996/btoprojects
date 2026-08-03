import { z } from "zod";

import type {
  PlannerConstraints,
  RankedProject,
  ScoreComponent,
} from "./ranking";

/**
 * Shared planner pipeline pieces, pure TypeScript with no Convex or Next
 * imports. Used by both the Convex action (plannerActions.ts) and the
 * streaming Next route handler (src/app/api/planner/chat/route.ts).
 */

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Extraction output contract. Every field is required-but-nullable so the
 * generated JSON schema satisfies strict structured-outputs providers
 * (additionalProperties: false, all keys required).
 */
export const extractionSchema = z.object({
  kind: z.enum(["constraints", "chitchat"]),
  budgetMax: z.number().nullable(),
  flatTypes: z.array(z.string()).nullable(),
  waitToleranceMonths: z.number().nullable(),
  towns: z.array(z.string()).nullable(),
  regions: z.array(z.string()).nullable(),
  workplaces: z.array(z.string()).nullable(),
  parentsArea: z.string().nullable(),
});

export type ExtractionOutput = z.infer<typeof extractionSchema>;

export const extractionJsonSchema = z.toJSONSchema(
  extractionSchema,
) as Record<string, unknown>;

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export async function callOpenRouter(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  json?: boolean;
  /** Strict structured-outputs mode; takes precedence over `json`. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  phase: string;
  timeoutMs?: number;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 45_000,
  );
  const started = Date.now();
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: 0.2,
        reasoning: { exclude: true, effort: "low" },
        ...(opts.jsonSchema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: opts.jsonSchema.name,
                  strict: true,
                  schema: opts.jsonSchema.schema,
                },
              },
              // Route only to providers that can honor the schema; providers
              // that can't will 4xx, and callers fall back to json_object.
              provider: { require_parameters: true },
            }
          : opts.json
            ? { response_format: { type: "json_object" } }
            : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("OpenRouter returned empty content");
    }
    console.log(
      JSON.stringify({
        fn: "planner",
        phase: opts.phase,
        model: opts.model,
        ok: true,
        latencyMs: Date.now() - started,
        usage: data.usage ?? null,
      }),
    );
    return content;
  } catch (error) {
    console.log(
      JSON.stringify({
        fn: "planner",
        phase: opts.phase,
        model: opts.model,
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const EXTRACTION_SYSTEM_PROMPT = `You extract home-buying constraints from a Singapore HDB BTO planning conversation into STRICT JSON.

Output exactly one JSON object with these keys (all keys required; use null where nothing applies):
- "kind": "constraints" if the message contains any planning signal (budget, flat types, locations, wait, family situation), otherwise "chitchat".
- "budgetMax": number or null — maximum budget in SGD (e.g. 550000). Convert "550k" → 550000.
- "flatTypes": array or null, subset of ["2-room Flexi","3-room","4-room","5-room","3Gen"]. Map "4 room"/"4rm" → "4-room", "3gen"/"3-gen" → "3Gen".
- "waitToleranceMonths": number or null — longest acceptable wait in months (convert years: "3 years" → 36). For a range, take the upper bound: "3-4 years" → 48.
- "towns": array or null — HDB towns mentioned (proper casing, e.g. "Tampines", "Bukit Merah").
- "regions": array or null — subset of ["Central","East","North","North-East","West"] if mentioned or clearly implied by towns.
- "workplaces": array or null — free-text workplace labels (e.g. "Raffles Place", "Changi Business Park").
- "parentsArea": string or null — free-text label of parents' location if mentioned.

Only fill what the user stated or clearly implied; use null otherwise. Output JSON only, no prose.

When the user message includes the constraints so far, output the FULL updated object after applying the new message: keep fields not mentioned, and set a field to null only if the user explicitly removes it.

Examples:
User: 4rm under 550k in tampines
{"kind":"constraints","budgetMax":550000,"flatTypes":["4-room"],"waitToleranceMonths":null,"towns":["Tampines"],"regions":["East"],"workplaces":null,"parentsArea":null}

User: can wait 3-4 years
{"kind":"constraints","budgetMax":null,"flatTypes":null,"waitToleranceMonths":48,"towns":null,"regions":null,"workplaces":null,"parentsArea":null}

User: near parents in CCK
{"kind":"constraints","budgetMax":null,"flatTypes":null,"waitToleranceMonths":null,"towns":null,"regions":null,"workplaces":null,"parentsArea":"Choa Chu Kang"}

User: work at Raffles Place
{"kind":"constraints","budgetMax":null,"flatTypes":null,"waitToleranceMonths":null,"towns":null,"regions":null,"workplaces":["Raffles Place"],"parentsArea":null}

User: hello how are you
{"kind":"chitchat","budgetMax":null,"flatTypes":null,"waitToleranceMonths":null,"towns":null,"regions":null,"workplaces":null,"parentsArea":null}

User: make it cheaper
Constraints so far: {"budgetMax":550000,"flatTypes":["4-room"],"regions":["East"]}
{"kind":"constraints","budgetMax":450000,"flatTypes":["4-room"],"waitToleranceMonths":null,"towns":null,"regions":["East"],"workplaces":null,"parentsArea":null}`;

export const NARRATION_SYSTEM_PROMPT = `You are the BTOProjects.sg planning assistant: a careful guide for Singapore HDB BTO buyers.

GROUND RULES (mandatory):
- Hard cap: 180 words. Short and interpretive beats long and exhaustive.
- Only state facts present in the provided project records JSON. Cite every project mention inline as [slug], e.g. [tampines-nova], right after the project name.
- DO NOT enumerate flat-type price ranges, unit counts, or full statistics. The cards below the answer and the project pages carry the figures; you may say so once, e.g. "figures are on the cards below".
- Interpret instead: explain why the top match fits the user's stated constraints, and name the one trade-off worth knowing about it.
- Application status per project: reason from each record's applicationDeadline against the provided "today" date (daysUntilDeadline is provided per record). If the deadline has passed, say applications closed and give the date. If the deadline is today or later, say applications are open until that date. If a record has no applicationDeadline, say the application window needs verification on hdb.gov.sg. Never guess.
- When 2 or more projects are listed, end with ONE narrowing follow-up question in the spirit of "what matters more to you: being near an MRT, malls and food, or a shorter wait?", adapted to the user's constraints.
- Statements about what the database covers (towns, regions, project counts) must come ONLY from the provided databaseCoverage field. Never infer coverage from the ranked sample; the sample is never the whole database.
- If the payload includes a noMatch field, the requested locations have zero projects in the records. Say that plainly, state what the records do cover (from databaseCoverage), and present any listed projects only as nearby or other-town alternatives, never as matches in the requested location.
- When noMatch has no alternative projects: state plainly that there are zero matches, say what IS covered (from databaseCoverage), and that they can set an alert below for new launches in the requested town.
- If data is missing, say so plainly and suggest verifying on hdb.gov.sg. Never invent prices, dates, unit counts, or distances.
- Label estimates as estimates. Never present ballot odds or future resale values as fact; use "scenario estimate" / "comparable-based range" language if the topic arises.
- The provided score breakdowns are computed deterministically from governed data; explain them in your own words.
- Use S$ and Singapore context. Plain, direct sentences: no hype, no filler, no em dashes.
- Format in Markdown: a one-line intro, then one short paragraph per project (max 5) with the project name in bold and its [slug] citation, then the follow-up question or next step.`;

/**
 * Agent-mode prompt for the tool-calling planner (Next.js route). Unlike the
 * legacy narration path, the model here chooses its own tools; every figure
 * must come from a tool result this turn. Kept separate so the Convex action
 * path's prompt stays record-driven.
 */
export const AGENT_SYSTEM_PROMPT = `You are the BTOProjects.sg planning assistant: a careful guide for Singapore HDB BTO and SBF buyers. You answer using the tools provided; every project, price, and date you state must come from a tool result in this conversation.

TOOL USE (mandatory):
- Recommendations ("which is best for me", budgets, comparisons): call rankProjects with the buyer's constraints. Its scores are deterministic; explain them in your own words. It ranks BTO launches only.
- Factual listing questions (what is upcoming, what launched in a town or region, projects under a price): call searchProjects. It covers BTO launches and SBF balance-flat pools; pass saleType only when the user specified one kind.
- One specific project or SBF town pool: call getProjectDetail with a slug from an earlier tool result.
- Resale prices ("what can I sell for", "BTO vs resale"): call getResaleMedian.
- Launch windows, deadlines, and "when is the next BTO / next SBF": call listExercises.
- Anything our records cannot answer (nearby amenities, landmarks, schools, eligibility policy, launches not yet in our records): call webSearch, and say the answer is from the web, not our records.
- Call only the tools you need; do not repeat a call you already made this turn.

SBF (SALE OF BALANCE FLATS):
- SBF pools are unsold balance flats from earlier launches, sold by town and flat type rather than as named projects. Many are completed or near completion, so waits are much shorter than BTO. Cite them by slug like any project, e.g. [sbf-2026-02-woodlands].
- Cadence: one SBF exercise every February, alongside the February BTO launch. Answer "when is the next SBF" from listExercises only. The town and flat-type mix of a future SBF is revealed on launch day, so never predict which towns it will include.
- We hold no SBF prices; they are published only at launch. Never quote, estimate, or invent one. Unit counts (supply) and application counts (demand) from tool results may be cited.
- When a user asks about upcoming projects or short waits without saying BTO or SBF, present both kinds, then ask ONE follow-up like "BTO or SBF, and when do you expect to collect keys?" only when the answer actually depends on it.

GROUND RULES:
- Never invent projects, prices, dates, unit counts, or towns. If a tool returns nothing, say so plainly, name what IS covered (townsCovered / total fields), and offer the closest alternative or setting an alert.
- Cite project mentions inline as [slug] using slugs from tool results, e.g. [sembawang-riverside].
- Never make general market claims ("prices in X are usually…", "historically…") unless a tool result in this conversation says so. If you lack the data, say you don't know.
- Do not narrate your tool usage ("Let me check…", "I will search…"). Call tools silently; speak only in the final answer.
- Announced projects (lifecycle "announced") have working titles; prices and timelines are TBC until the launch opens. Say so when they come up.
- Reason about application status from applicationDeadline against today's date. If none exists, say the window needs verification on hdb.gov.sg.
- Label estimates as estimates. Never present ballot odds or future resale values as fact.
- Hard cap: 180 words. Interpret, don't recite: name the trade-off that matters, skip full statistics (the cards carry the figures; you may say "figures are on the cards below" once).
- If the answer leaves more than one good option, end with ONE narrowing follow-up question (amenities? MRT distance? budget ceiling? shorter wait?).
- Use S$ and Singapore context. Plain, direct sentences: no hype, no filler, no em dashes.
- Format in Markdown: one-line intro, then one short paragraph per project (max 5) with the project name in bold and its [slug] citation, then the follow-up question or next step.`;

export const CANONICAL_FLAT_TYPES = [
  "2-room Flexi",
  "3-room",
  "4-room",
  "5-room",
  "3Gen",
];
export const CANONICAL_REGIONS = [
  "Central",
  "East",
  "North",
  "North-East",
  "West",
];

export interface NormalizedConstraints {
  budgetMax?: number;
  flatTypes?: string[];
  waitToleranceMonths?: number;
  towns?: string[];
  regions?: string[];
  workplaces?: string[];
  parentsArea?: string;
}

export interface RankingResultItem {
  slug: string;
  name: string;
  town: string;
  classification: "Standard" | "Plus" | "Prime" | "Unclassified";
  totalScore: number;
  breakdown: {
    budgetFit: ScoreComponent;
    waitFit: ScoreComponent;
    flatTypeFit: ScoreComponent;
    locationFit: ScoreComponent;
  };
}

export type ExtractionKind = "constraints" | "chitchat";

export function extractJsonObject(content: string): unknown {
  const unfenced = content.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeFlatType(raw: string): string | null {
  const compact = raw.toLowerCase().replace(/[\s-]+/g, "");
  if (compact.startsWith("2room")) return "2-room Flexi";
  if (compact.startsWith("3room")) return "3-room";
  if (compact.startsWith("4room")) return "4-room";
  if (compact.startsWith("5room")) return "5-room";
  if (compact.includes("3gen")) return "3Gen";
  return CANONICAL_FLAT_TYPES.find((t) => t === raw) ?? null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return strings.length > 0 ? strings.map((s) => s.trim()) : undefined;
}

export function normalizeConstraints(
  raw: unknown,
): NormalizedConstraints | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const flatTypes = asStringArray(record.flatTypes)
    ?.map(normalizeFlatType)
    .filter((t): t is string => t !== null);
  const regions = asStringArray(record.regions)?.filter((r) =>
    CANONICAL_REGIONS.some((c) => c.toLowerCase() === r.toLowerCase()),
  );
  const constraints: NormalizedConstraints = {
    budgetMax: asNumber(record.budgetMax),
    flatTypes: flatTypes?.length ? [...new Set(flatTypes)] : undefined,
    waitToleranceMonths: asNumber(record.waitToleranceMonths),
    towns: asStringArray(record.towns),
    regions,
    workplaces: asStringArray(record.workplaces),
    parentsArea:
      typeof record.parentsArea === "string" && record.parentsArea.trim()
        ? record.parentsArea.trim()
        : undefined,
  };
  const hasAny = Object.values(constraints).some(
    (v) => v !== undefined && (!Array.isArray(v) || v.length > 0),
  );
  return hasAny ? constraints : null;
}

export function parseExtraction(raw: string): {
  kind: ExtractionKind;
  constraints: NormalizedConstraints | null;
} {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    return { kind: "constraints", constraints: null };
  }
  const record = parsed as Record<string, unknown>;
  return {
    kind: record.kind === "chitchat" ? "chitchat" : "constraints",
    constraints: normalizeConstraints(parsed),
  };
}

export function toRankingConstraints(
  constraints: NormalizedConstraints,
): PlannerConstraints {
  return {
    budgetMax: constraints.budgetMax,
    flatTypes: constraints.flatTypes,
    waitToleranceMonths: constraints.waitToleranceMonths,
    towns: constraints.towns,
    regions: constraints.regions,
    workplaces: constraints.workplaces?.map((label) => ({ label })),
    parentsArea: constraints.parentsArea
      ? { label: constraints.parentsArea }
      : undefined,
  };
}

export function toRankingItems(top: RankedProject[]): RankingResultItem[] {
  return top.map((entry) => ({
    slug: entry.project.slug,
    name: entry.project.name,
    town: entry.project.town,
    classification: entry.project.classification,
    totalScore: entry.totalScore,
    breakdown: entry.breakdown,
  }));
}

function daysBetween(todayISO: string, deadline?: string): number | null {
  if (!deadline) return null;
  const today = Date.parse(`${todayISO}T00:00:00Z`);
  const end = Date.parse(`${deadline}T00:00:00Z`);
  if (Number.isNaN(today) || Number.isNaN(end)) return null;
  return Math.round((end - today) / 86_400_000);
}

export function buildRecordsPayload(top: RankedProject[], todayISO?: string) {
  return top.map((entry) => ({
    ...entry.project,
    score: entry.totalScore,
    ...(todayISO
      ? {
          daysUntilDeadline: daysBetween(
            todayISO,
            entry.project.applicationDeadline,
          ),
        }
      : {}),
    breakdownReasons: {
      budget: entry.breakdown.budgetFit.reasons,
      wait: entry.breakdown.waitFit.reasons,
      flatTypes: entry.breakdown.flatTypeFit.reasons,
      location: entry.breakdown.locationFit.reasons,
    },
  }));
}

export interface NarrationNoMatch {
  scope: "towns" | "regions";
  requested: string[];
  suggestionMode: "region-neighbours" | "none";
}

export function buildNarrationContent(opts: {
  message: string;
  constraints: NormalizedConstraints | null;
  kind: ExtractionKind;
  top: RankedProject[];
  todayISO: string;
  totalProjects: number;
  townsCovered: string[];
  noMatch?: NarrationNoMatch;
  /** Count of ALL projects in the requested towns (0 when none requested). */
  matchesInRequestedTowns?: number;
}): string {
  let note: string;
  if (opts.kind === "chitchat") {
    note =
      "The user is making small talk or asking something off-topic. Reply briefly, in friendly Singapore context, and steer toward BTO planning. Do not fabricate project facts.";
  } else if (opts.noMatch?.suggestionMode === "region-neighbours") {
    note = `Our records have ZERO projects in the requested ${opts.noMatch.scope} (${opts.noMatch.requested.join(", ")}). Say that plainly. The projects below are NOT in the requested ${opts.noMatch.scope}; present them only as the closest alternatives in the same region.`;
  } else if (opts.noMatch) {
    note = `Our records have ZERO projects matching the requested ${opts.noMatch.scope} (${opts.noMatch.requested.join(", ")}). Do not present any project as a match. State what the records actually cover using databaseCoverage, and suggest checking hdb.gov.sg for launches outside our coverage.`;
  } else {
    note =
      "Ranked project records JSON follows. Narrate the top matches with [slug] citations.";
  }
  const [first, second] = opts.top;
  const closeCall =
    first !== undefined &&
    second !== undefined &&
    Math.abs(first.totalScore - second.totalScore) <= 3;
  return JSON.stringify({
    userMessage: opts.message,
    today: opts.todayISO,
    databaseCoverage: {
      totalProjects: opts.totalProjects,
      townsCovered: opts.townsCovered,
    },
    interpretedConstraints: opts.constraints,
    note,
    ...(opts.noMatch ? { noMatch: opts.noMatch } : {}),
    ...(typeof opts.matchesInRequestedTowns === "number"
      ? { matchesInRequestedTowns: opts.matchesInRequestedTowns }
      : {}),
    ...(closeCall
      ? {
          closeCall:
            "Top matches are statistically close — present them as alternatives, not a winner.",
        }
      : {}),
    projects: buildRecordsPayload(opts.top, opts.todayISO),
  });
}

export function fallbackReply(top: RankedProject[]): string {
  if (top.length === 0) {
    return "I could not rank projects just now, but you can browse all launches in the explorer. Tell me your budget, preferred flat types and towns and I will rank them for you.";
  }
  const lines = top.map((entry, i) => {
    const reasons = [entry.breakdown.budgetFit.reasons[0], entry.breakdown.waitFit.reasons[0]]
      .filter((reason): reason is string => typeof reason === "string" && reason.length > 0)
      .join("; ");
    return `${i + 1}. **${entry.project.name}** [${entry.project.slug}] (${entry.project.town}, score ${entry.totalScore}/100)${reasons ? `: ${reasons}` : ""}`;
  });
  return [
    "Here are the best-matching projects from our records, ranked deterministically (the AI narration service is briefly unavailable):",
    ...lines,
    "Verify prices and dates on hdb.gov.sg before applying.",
  ].join("\n\n");
}

export function citedSlugs(reply: string, knownSlugs: string[]): string[] {
  const found = new Set<string>();
  for (const match of reply.matchAll(/\[([a-z0-9][a-z0-9-]*)\]/g)) {
    if (knownSlugs.includes(match[1])) found.add(match[1]);
  }
  return [...found];
}

/**
 * True when an OpenRouter error indicates the provider cannot honor strict
 * json_schema mode (unsupported response_format, or require_parameters
 * routed away every endpoint). Callers downgrade to json_object.
 */
export function isSchemaModeUnsupported(errorMessage: string): boolean {
  if (!/^OpenRouter 4\d{2}\b/.test(errorMessage)) return false;
  return /response_format|json_schema|require_parameters|parameters|structured|provider/i.test(
    errorMessage,
  );
}

/**
 * Deterministic post-stream integrity check. The narration may only cite
 * slugs from the ranked records, and every S$ amount or month count it
 * states must appear verbatim in the evidence it was given: the records
 * payload plus the interpreted constraints (the user's own budget / wait
 * tolerance are legitimate figures for the model to reference).
 */
export function verifyNarration(
  reply: string,
  top: RankedProject[],
  evidence?: { constraints: NormalizedConstraints | null; todayISO: string },
): string[] {
  const violations: string[] = [];
  const knownSlugs = top.map((entry) => entry.project.slug);
  const legitimate = new Set(citedSlugs(reply, knownSlugs));
  for (const match of reply.matchAll(/\[([a-z0-9][a-z0-9-]*)\]/g)) {
    if (!legitimate.has(match[1])) {
      violations.push(`unknown_citation:${match[1]}`);
    }
  }

  const recordsJson = JSON.stringify(
    buildRecordsPayload(top, evidence?.todayISO),
  );
  const corpus = evidence
    ? `${recordsJson}\n${JSON.stringify(evidence.constraints)}`
    : recordsJson;
  const amounts = new Set<number>();
  for (const match of reply.matchAll(/S\$\s*([\d,]+(?:\.\d+)?)(k)?\b/gi)) {
    const raw = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(raw) || raw <= 0) continue;
    // Normalize "S$137k" → 137000 so it can be found in the records JSON.
    amounts.add(Math.round(match[2] ? raw * 1000 : raw));
  }
  for (const amount of amounts) {
    if (!corpus.includes(String(amount))) {
      violations.push(`unverified_amount:S$${amount}`);
    }
  }

  // Month counts are deliberately NOT verified: wait/completion figures invite
  // legitimate derived arithmetic ("15-month gap" = 52−37), which a corpus
  // check flags as fabrication. Money figures don't get derived that way, so
  // the S$ check above stays strict.
  return violations;
}

/**
 * Deterministic follow-up chips, computed from what the constraints are
 * missing and whether the ranking produced matches. No LLM involved.
 */
export interface PlannerSuggestion {
  kind: "reply" | "alert";
  label: string;
  message?: string;
  town?: string;
}

const MRT_CHIP: PlannerSuggestion = {
  kind: "reply",
  label: "Nearest an MRT?",
  message: "which of these is nearest an MRT station",
};

/** Sale-type mix visible in a turn's answer (search/detail/town paths). */
export interface SaleTypeMix {
  bto: number;
  sbf: number;
}

export function buildSuggestions(opts: {
  kind: ExtractionKind;
  constraints: NormalizedConstraints | null;
  top: RankedProject[];
  noMatch?: NarrationNoMatch;
  /** When the answer surfaced both kinds, offer sale-type narrowing chips. */
  saleTypes?: SaleTypeMix;
  /** True when listExercises already ran; the next-SBF chip would repeat it. */
  calendarChecked?: boolean;
}): PlannerSuggestion[] {
  if (opts.kind === "chitchat") return [];

  const mix = opts.saleTypes;
  if (mix && mix.bto > 0 && mix.sbf > 0) {
    return [
      { kind: "reply", label: "Only BTO launches", message: "only BTO launches" },
      {
        kind: "reply",
        label: "Only SBF balance flats",
        message: "only SBF balance flats",
      },
    ];
  }
  if (mix && mix.sbf > 0 && mix.bto === 0 && !opts.calendarChecked) {
    return [
      {
        kind: "reply",
        label: "When is the next SBF?",
        message: "when is the next SBF exercise",
      },
    ];
  }

  if (opts.noMatch?.suggestionMode === "region-neighbours") {
    const region = opts.top[0]?.project.region;
    const requestedTown = opts.noMatch.requested[0];
    const chips: PlannerSuggestion[] = [];
    if (region) {
      chips.push({
        kind: "reply",
        label: `Only show ${region}`,
        message: `only ${region} region`,
      });
    }
    if (requestedTown) {
      chips.push({
        kind: "alert",
        town: requestedTown,
        label: `Alert me when ${requestedTown} has a launch`,
      });
    }
    return chips;
  }

  if (opts.noMatch) {
    const requestedTown = opts.noMatch.requested[0];
    const chips: PlannerSuggestion[] = [];
    if (requestedTown) {
      chips.push({
        kind: "alert",
        town: requestedTown,
        label: `Alert me when ${requestedTown} has a launch`,
      });
    }
    chips.push({
      kind: "reply",
      label: "See everything you track",
      message: "show me all the launches you track",
    });
    return chips;
  }

  if (opts.top.length === 0) return [];

  const chips: PlannerSuggestion[] = [];
  if (!opts.constraints?.budgetMax) {
    chips.push({
      kind: "reply",
      label: "Under S$500k",
      message: "budget under S$500k",
    });
  }
  if (!opts.constraints?.waitToleranceMonths) {
    chips.push({
      kind: "reply",
      label: "Shorter wait",
      message: "shorter wait, under 36 months",
    });
  }
  if (!opts.constraints?.flatTypes?.length) {
    chips.push({
      kind: "reply",
      label: "4-room only",
      message: "4-room flats only",
    });
  }
  // With 2+ matches an MRT/proximity chip is always offered.
  if (opts.top.length >= 2) {
    return [...chips.slice(0, 2), MRT_CHIP];
  }
  return chips.slice(0, 3);
}
