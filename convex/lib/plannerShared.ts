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
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
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

Output exactly one JSON object with these keys:
- "kind": "constraints" if the message contains any planning signal (budget, flat types, locations, wait, family situation), otherwise "chitchat".
- "budgetMax": number or null — maximum budget in SGD (e.g. 550000). Convert "550k" → 550000.
- "flatTypes": array, subset of ["2-room Flexi","3-room","4-room","5-room","3Gen"]. Map "4 room"/"4rm" → "4-room", "3gen"/"3-gen" → "3Gen".
- "waitToleranceMonths": number or null — longest acceptable wait in months (convert years: "3 years" → 36).
- "towns": string[] — HDB towns mentioned (proper casing, e.g. "Tampines", "Bukit Merah").
- "regions": string[] — subset of ["Central","East","North","North-East","West"] if mentioned or clearly implied by towns.
- "workplaces": string[] — free-text workplace labels (e.g. "Raffles Place", "Changi Business Park").
- "parentsArea": string or null — free-text label of parents' location if mentioned.

Only fill what the user stated or clearly implied; use null/[] otherwise. Output JSON only, no prose.`;

export const NARRATION_SYSTEM_PROMPT = `You are the BTOProjects.sg planning assistant: a careful guide for Singapore HDB BTO buyers.

GROUND RULES (mandatory):
- Only state facts present in the provided project records JSON. Cite every project mention inline as [slug], e.g. [tampines-nova].
- If data is missing, say so plainly and suggest verifying on hdb.gov.sg. Never invent prices, dates, unit counts, or distances.
- Label estimates as estimates. Never present ballot odds or future resale values as fact; use "scenario estimate" / "comparable-based range" language if the topic arises.
- The provided score breakdowns are computed deterministically from governed data; explain them in your own words.
- Use S$ and Singapore context. Plain, direct sentences: no hype, no filler.
- Format in Markdown: a one-line intro, then one compact section per project (max 5) with the project name in bold and its [slug] citation, then a one-line suggested next step. Under 250 words.`;

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
  classification: "Standard" | "Plus" | "Prime";
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

export function buildRecordsPayload(top: RankedProject[]) {
  return top.map((entry) => ({
    ...entry.project,
    score: entry.totalScore,
    breakdownReasons: {
      budget: entry.breakdown.budgetFit.reasons,
      wait: entry.breakdown.waitFit.reasons,
      flatTypes: entry.breakdown.flatTypeFit.reasons,
      location: entry.breakdown.locationFit.reasons,
    },
  }));
}

export function buildNarrationContent(opts: {
  message: string;
  constraints: NormalizedConstraints | null;
  kind: ExtractionKind;
  top: RankedProject[];
}): string {
  return JSON.stringify({
    userMessage: opts.message,
    interpretedConstraints: opts.constraints,
    note:
      opts.kind === "chitchat"
        ? "The user is making small talk or asking something off-topic. Reply briefly, in friendly Singapore context, and steer toward BTO planning. Do not fabricate project facts."
        : "Ranked project records JSON follows. Narrate the top matches with [slug] citations.",
    projects: buildRecordsPayload(opts.top),
  });
}

export function fallbackReply(top: RankedProject[]): string {
  if (top.length === 0) {
    return "I could not rank projects just now, but you can browse all launches in the explorer. Tell me your budget, preferred flat types and towns and I will rank them for you.";
  }
  const lines = top.map(
    (entry, i) =>
      `${i + 1}. **${entry.project.name}** [${entry.project.slug}] (${entry.project.town}, score ${entry.totalScore}/100): ${entry.breakdown.budgetFit.reasons[0] ?? ""} ${entry.breakdown.waitFit.reasons[0] ?? ""}`.trim(),
  );
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
