import { tool, type InferUITools, type UIMessageStreamWriter } from "ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { rankProjects } from "../../../convex/lib/ranking";
import {
  buildSuggestions,
  normalizeConstraints,
  toRankingConstraints,
  toRankingItems,
  type NarrationNoMatch,
} from "../../../convex/lib/plannerShared";
import type { PlannerPhaseId, PlannerUIMessage } from "./types";

/**
 * The planner's read-only toolbox. Every factual claim the model makes must
 * be grounded in one of these tool results: the deterministic ranker for
 * recommendations, filtered listing for factual questions, town-level resale
 * medians for price context, and a Tavily-backed web search for anything our
 * governed records do not cover (amenities, landmarks, eligibility news).
 *
 * The same registry ("corpus") that feeds tool results also feeds the
 * post-stream verification pass: any slug or dollar figure in the final
 * answer must have come through a tool this turn.
 */

export interface TurnCorpus {
  slugs: Set<string>;
  amounts: Set<number>;
  months: Set<number>;
  /** True once rankProjects has run this turn (drives cards + trust line). */
  ranked: boolean;
  /** Deterministic replacement answer if post-stream verification fails. */
  fallbackText: string | null;
}

export function createTurnCorpus(): TurnCorpus {
  return {
    slugs: new Set(),
    amounts: new Set(),
    months: new Set(),
    ranked: false,
    fallbackText: null,
  };
}

/** A project stripped to what the model needs to reason and cite. */
export interface ToolProjectSummary {
  slug: string;
  name: string;
  town: string;
  region: string;
  classification: string;
  lifecycle: string;
  exerciseLabel: string | null;
  totalUnits: number;
  priceRange: { min: number; max: number } | null;
  flatTypes: { type: string; units: number; minPrice: number; maxPrice: number }[];
  estimatedWaitMonths: number | null;
  estimatedCompletion: string | null;
  applicationDeadline: string | null;
  nearestMrt: string[];
}

function summarizeProject(
  project: Doc<"projects">,
  town: Doc<"towns"> | null,
  flatTypes: Doc<"flatTypes">[],
  exerciseLabel?: string | null,
): ToolProjectSummary {
  const announced = project.lifecycleStatus === "announced";
  const priced = flatTypes.filter((f) => f.minPrice > 0 || f.maxPrice > 0);
  const priceRange =
    announced || priced.length === 0
      ? null
      : {
          min: Math.min(...priced.map((f) => f.minPrice)),
          max: Math.max(...priced.map((f) => f.maxPrice)),
        };
  return {
    slug: project.slug,
    name: project.name,
    town: town?.name ?? "",
    region: town?.region ?? "",
    classification: project.classification,
    lifecycle: project.lifecycleStatus,
    exerciseLabel: exerciseLabel ?? null,
    totalUnits: project.totalUnits,
    priceRange,
    flatTypes: announced
      ? flatTypes.map((f) => ({ type: f.type, units: f.units, minPrice: 0, maxPrice: 0 }))
      : flatTypes.map((f) => ({
          type: f.type,
          units: f.units,
          minPrice: f.minPrice,
          maxPrice: f.maxPrice,
        })),
    estimatedWaitMonths: announced ? null : project.estimatedWaitMonths,
    estimatedCompletion: announced ? null : project.estimatedCompletion,
    applicationDeadline: project.applicationDeadline ?? null,
    nearestMrt: project.nearestMrt,
  };
}

function registerSummary(corpus: TurnCorpus, summary: ToolProjectSummary): void {
  corpus.slugs.add(summary.slug);
  for (const f of summary.flatTypes) {
    if (f.minPrice > 0) corpus.amounts.add(f.minPrice);
    if (f.maxPrice > 0) corpus.amounts.add(f.maxPrice);
  }
  if (summary.estimatedWaitMonths !== null && summary.estimatedWaitMonths > 0) {
    corpus.months.add(summary.estimatedWaitMonths);
  }
}

/** Town casing used by the resale dataset: "KALLANG/WHAMPOA" → "Kallang/Whampoa". */
function titleCaseTown(name: string): string {
  return name
    .trim()
    .split(/([\s/]+)/)
    .map((segment) =>
      /^[\s/]+$/.test(segment) || segment.length === 0
        ? segment
        : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
    )
    .join("");
}

/**
 * Agent-path replacement for a failed citation check: honest about what
 * happened (unlike fallbackReply, which describes a narration outage that
 * only the legacy Convex action path can have), and reasons are separated.
 */
function verifiedReplacement(top: ReturnType<typeof rankProjects>): string {
  if (top.length === 0) {
    return "I could not verify that answer against our records, so I have replaced it. No matching projects were found; set an alert below and we will let you know when a new launch appears.";
  }
  const lines = top.map((entry, i) => {
    const reasons = [
      entry.breakdown.budgetFit.reasons[0],
      entry.breakdown.waitFit.reasons[0],
    ]
      .filter((reason): reason is string => typeof reason === "string" && reason.length > 0)
      .join("; ");
    return `${i + 1}. **${entry.project.name}** [${entry.project.slug}] (${entry.project.town}, score ${entry.totalScore}/100)${reasons ? `: ${reasons}` : ""}`;
  });
  return [
    "I could not verify my first draft against the records, so here is the verified ranking instead:",
    ...lines,
    "Figures are on the cards below; verify dates on hdb.gov.sg before applying.",
  ].join("\n\n");
}

const classificationInput = z.enum(["Standard", "Plus", "Prime"]);

export interface PlannerToolDeps {
  convex: ConvexHttpClient;
  writer: UIMessageStreamWriter<PlannerUIMessage>;
  corpus: TurnCorpus;
  tavilyApiKey: string | undefined;
  signal: AbortSignal;
  todayISO: string;
}

export function createPlannerTools(deps: PlannerToolDeps) {
  const { convex, writer, corpus } = deps;

  const phase = (phaseId: PlannerPhaseId, label: string) => {
    writer.write({
      type: "data-phase",
      data: { phase: phaseId, label },
      transient: true,
    });
  };

  const searchProjects = tool({
    description:
      "Filter the launch records. Use for factual questions: what is upcoming, what launched in a town or region, projects under a price, with a flat type, or by name. Announced projects (lifecycle 'announced') are officially confirmed for a future exercise but have no prices or timeline yet.",
    inputSchema: z.object({
      town: z.string().optional().describe("Town name, e.g. Woodlands"),
      region: z.string().optional().describe("One of: North, North-East, Central, East, West"),
      classification: classificationInput.optional(),
      lifecycle: z
        .enum(["launched", "announced"])
        .optional()
        .describe("launched = past or open exercise; announced = confirmed for a future exercise"),
      flatType: z.string().optional().describe("e.g. 4-room"),
      maxPrice: z.number().optional().describe("Max starting price in SGD"),
      maxWaitMonths: z.number().optional(),
      search: z.string().optional().describe("Free-text match on project or town name"),
      limit: z.number().min(1).max(12).optional(),
    }),
    execute: async (args) => {
      phase(
        "searching",
        `Searching the launch records${args.town ? ` in ${args.town}` : args.region ? ` in the ${args.region} region` : ""}`,
      );
      const summaries = await convex.query(api.projects.list, {
        region: args.region,
        town: args.town,
        classification: args.classification,
        flatType: args.flatType,
        maxPrice: args.maxPrice,
        maxWaitMonths: args.maxWaitMonths,
        search: args.search,
      });
      const filtered = args.lifecycle
        ? summaries.filter((s) => s.project.lifecycleStatus === args.lifecycle)
        : summaries;
      if (args.maxPrice !== undefined && args.maxPrice > 0) {
        corpus.amounts.add(args.maxPrice);
      }
      const limit = args.limit ?? 8;
      const projects = filtered
        .slice(0, limit)
        .map((s) => summarizeProject(s.project, s.town, s.flatTypes));
      for (const p of projects) registerSummary(corpus, p);
      return {
        total: filtered.length,
        returned: projects.length,
        projects,
        ...(filtered.length === 0
          ? {
              note: "No projects match. Say so plainly and suggest widening the filters or setting an alert.",
            }
          : {}),
      };
    },
  });

  const getProjectDetail = tool({
    description:
      "Full details for one project by slug (from a previous tool result). Use when the user asks about a specific project.",
    inputSchema: z.object({
      slug: z.string().describe("Project slug, e.g. sembawang-riverside"),
    }),
    execute: async ({ slug }) => {
      phase("details", `Reading ${slug}`);
      const details = await convex.query(api.projects.getBySlug, { slug });
      if (!details) {
        return {
          found: false,
          note: "No project with that slug. Use searchProjects to find the right one.",
        };
      }
      const summary = summarizeProject(
        details.project,
        details.town,
        details.flatTypes,
        details.exercise?.label ?? null,
      );
      registerSummary(corpus, summary);
      return {
        found: true,
        ...summary,
        description: details.project.description ?? null,
        notes: details.project.notes ?? null,
        exerciseStatus: details.exercise?.status ?? null,
        applicationDeadline: details.exercise?.applicationEnd ?? summary.applicationDeadline,
      };
    },
  });

  const rankProjectsTool = tool({
    description:
      "Personalized recommendation: scores every launchable project against the buyer's constraints (deterministic, not your judgement) and returns the top 5 with reasons. Use whenever the user asks what is best for them, compares options, or gives a budget/wait/town profile. Fields not mentioned stay unset.",
    inputSchema: z.object({
      budgetMax: z.number().optional().describe("Max affordable price in SGD"),
      waitToleranceMonths: z.number().optional().describe("Max months the buyer can wait for keys"),
      towns: z.array(z.string()).optional(),
      regions: z.array(z.string()).optional(),
      flatTypes: z.array(z.string()).optional().describe("e.g. [\"3-room\", \"4-room\"]"),
      workplaces: z.array(z.string()).optional(),
      parentsArea: z.string().optional(),
    }),
    execute: async (args) => {
      phase("ranking", "Scoring projects against your constraints");
      const constraints = normalizeConstraints({
        kind: "constraints",
        budgetMax: args.budgetMax ?? null,
        flatTypes: args.flatTypes ?? null,
        waitToleranceMonths: args.waitToleranceMonths ?? null,
        towns: args.towns ?? null,
        regions: args.regions ?? null,
        workplaces: args.workplaces ?? null,
        parentsArea: args.parentsArea ?? null,
      });
      if (constraints === null) {
        return {
          note: "No usable constraints were provided. Ask ONE clarifying question (budget, towns, flat type, or how long they can wait) instead of ranking.",
        };
      }
      const all = await convex.query(api.planner.forRanking, {});
      const ranked = rankProjects(all, toRankingConstraints(constraints));
      let top: typeof ranked = [];
      let noMatch: NarrationNoMatch | undefined;

      const requestedTowns = constraints?.towns ?? [];
      const requestedRegions = constraints?.regions ?? [];
      if (requestedTowns.length > 0) {
        const wantedTowns = new Set(requestedTowns.map((t) => t.toLowerCase()));
        const townHits = all.filter((p) => wantedTowns.has(p.town.toLowerCase()));
        if (townHits.length === 0) {
          const wantedRegions = new Set(requestedRegions.map((r) => r.toLowerCase()));
          const neighbours =
            wantedRegions.size > 0
              ? ranked.filter((entry) => wantedRegions.has(entry.project.region.toLowerCase()))
              : [];
          if (neighbours.length > 0) {
            top = neighbours.slice(0, 3);
            noMatch = {
              scope: "towns",
              requested: requestedTowns,
              suggestionMode: "region-neighbours",
            };
          } else {
            noMatch = { scope: "towns", requested: requestedTowns, suggestionMode: "none" };
          }
        }
      } else if (requestedRegions.length > 0) {
        const wantedRegions = new Set(requestedRegions.map((r) => r.toLowerCase()));
        if (!all.some((p) => wantedRegions.has(p.region.toLowerCase()))) {
          noMatch = { scope: "regions", requested: requestedRegions, suggestionMode: "none" };
        }
      }
      if (noMatch === undefined) {
        top = ranked.slice(0, 5);
      }

      const updatedAts = top
        .map((entry) => {
          const record = all.find((p) => p.slug === entry.project.slug);
          return record?.updatedAt;
        })
        .filter((value): value is number => typeof value === "number");
      const dataAsOf =
        updatedAts.length > 0
          ? new Date(Math.max(...updatedAts)).toISOString().slice(0, 10)
          : undefined;

      corpus.ranked = true;
      corpus.fallbackText = top.length > 0 ? verifiedReplacement(top) : null;
      // The user's own constraint figures are legitimate citations: quoting
      // "your S$500k budget" must not fail the amount check.
      if (args.budgetMax !== undefined && args.budgetMax > 0) {
        corpus.amounts.add(args.budgetMax);
      }
      writer.write({
        type: "data-constraints",
        id: "constraints",
        data: { constraints },
      });
      if (top.length > 0) {
        writer.write({
          type: "data-rankings",
          id: "rankings",
          data: {
            rankings: toRankingItems(top),
            totalProjects: all.length,
            ...(dataAsOf ? { dataAsOf } : {}),
          },
        });
        for (const entry of top) {
          corpus.slugs.add(entry.project.slug);
          for (const flat of entry.project.flatTypes) {
            if (flat.minPrice > 0) corpus.amounts.add(flat.minPrice);
            if (flat.maxPrice > 0) corpus.amounts.add(flat.maxPrice);
          }
          if (entry.project.estimatedWaitMonths > 0) {
            corpus.months.add(entry.project.estimatedWaitMonths);
          }
        }
      }
      const suggestions = buildSuggestions({ kind: "constraints", constraints, top, noMatch });
      if (suggestions.length > 0) {
        writer.write({ type: "data-suggestions", id: "suggestions", data: { suggestions } });
      }

      return {
        totalProjects: all.length,
        townsCovered: [...new Set(all.map((p) => p.town).filter((t) => t.length > 0))].sort(
          (a, b) => a.localeCompare(b),
        ),
        ...(dataAsOf ? { dataAsOf } : {}),
        top: top.map((entry) => {
          const priced = entry.project.flatTypes.filter(
            (f) => f.minPrice > 0 || f.maxPrice > 0,
          );
          const reasons = [
            ...entry.breakdown.budgetFit.reasons,
            ...entry.breakdown.waitFit.reasons,
            ...entry.breakdown.flatTypeFit.reasons,
            ...entry.breakdown.locationFit.reasons,
          ].slice(0, 4);
          return {
            slug: entry.project.slug,
            name: entry.project.name,
            town: entry.project.town,
            region: entry.project.region,
            classification: entry.project.classification,
            score: entry.totalScore,
            reasons,
            priceRange:
              priced.length === 0
                ? null
                : {
                    min: Math.min(...priced.map((f) => f.minPrice)),
                    max: Math.max(...priced.map((f) => f.maxPrice)),
                  },
            estimatedWaitMonths: entry.project.estimatedWaitMonths,
            estimatedCompletion: entry.project.estimatedCompletion,
            applicationDeadline: entry.project.applicationDeadline ?? null,
            exerciseLabel: entry.project.exerciseLabel ?? null,
          };
        }),
        ...(noMatch
          ? {
              noMatch,
              note: "Nothing matches the requested location. Say so plainly, point at the closest alternatives shown, and suggest setting an alert.",
            }
          : {}),
      };
    },
  });

  const getResaleMedian = tool({
    description:
      "Median resale price in a town over recent months (data.gov.sg transactions). Use for 'what can I sell for', 'BTO vs resale', or affordability context.",
    inputSchema: z.object({
      town: z.string().describe("Town name, e.g. Woodlands"),
      flatType: z.string().optional().describe("e.g. 4-room; omit for all types"),
      monthsBack: z.number().min(3).max(36).optional().describe("Window in months, default 12"),
    }),
    execute: async (args) => {
      const town = titleCaseTown(args.town);
      phase("resale", `Checking ${town} resale prices`);
      const asOfMonth = deps.todayISO.slice(0, 7);
      const result = await convex.query(api.resale.townMedian, {
        town,
        flatType: args.flatType,
        monthsBack: args.monthsBack,
        asOfMonth,
      });
      if (result.median !== null) {
        corpus.amounts.add(result.median);
        if (result.min !== null) corpus.amounts.add(result.min);
        if (result.max !== null) corpus.amounts.add(result.max);
        if (result.p25 !== null) corpus.amounts.add(result.p25);
        if (result.p75 !== null) corpus.amounts.add(result.p75);
      }
      return {
        ...result,
        ...(result.count === 0
          ? {
              note: "No resale transactions recorded for that town/type in the window. Check the town name or widen the window.",
            }
          : {}),
      };
    },
  });

  const listExercises = tool({
    description:
      "The BTO launch calendar: past, open, and announced sales exercises with application windows. Use for 'when is the next launch', deadlines, or which exercise a project belongs to.",
    inputSchema: z.object({}),
    execute: async () => {
      phase("calendar", "Checking the launch calendar");
      const exercises = await convex.query(api.exercises.list, {});
      return {
        exercises: exercises.map(({ exercise, projectCount }) => ({
          key: exercise.key,
          label: exercise.label,
          status: exercise.status,
          applicationEnd: exercise.applicationEnd ?? null,
          projectCount,
        })),
      };
    },
  });

  const getTownOverview = tool({
    description:
      "Everything we know about one town: its projects (launched and announced) plus recent resale medians. Use for 'tell me about Woodlands' style questions.",
    inputSchema: z.object({
      town: z.string().describe("Town name, e.g. Woodlands"),
    }),
    execute: async ({ town: townName }) => {
      phase("town", `Sizing up ${townName}`);
      const result = await convex.query(api.towns.getByName, {
        name: titleCaseTown(townName),
      });
      if (!result.town) {
        return {
          found: false,
          note: "We do not track that town. Check the spelling, or use webSearch if it is a neighbourhood or landmark rather than an HDB town.",
        };
      }
      const town = result.town;
      const projects = result.projects.map((s) =>
        summarizeProject(s.project, s.town, s.flatTypes),
      );
      for (const p of projects) registerSummary(corpus, p);
      const asOfMonth = deps.todayISO.slice(0, 7);
      const resale = await convex.query(api.resale.townMedian, {
        town: town.name,
        monthsBack: 12,
        asOfMonth,
      });
      if (resale.median !== null) corpus.amounts.add(resale.median);
      return {
        found: true,
        town: town.name,
        region: town.region,
        projects,
        resale12m: {
          count: resale.count,
          median: resale.median,
          latestMonth: resale.latestMonth,
        },
      };
    },
  });

  const webSearch = tool({
    description:
      "Search the public web (Tavily). ONLY for things our records cannot answer: nearby amenities, landmarks, schools, eligibility policy, or launches not yet in our records. Always say the answer is from the web, not our records.",
    inputSchema: z.object({
      query: z.string().describe("Short search query, e.g. 'Woodlands Regional Centre URA master plan'"),
    }),
    execute: async ({ query }) => {
      phase("web", "Searching the web");
      if (!deps.tavilyApiKey) {
        return {
          answer: null,
          results: [],
          note: "Web search is not configured right now; answer only from our records or say you do not know.",
        };
      }
      try {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${deps.tavilyApiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: 4,
            search_depth: "basic",
            include_answer: true,
          }),
          signal: deps.signal,
        });
        if (!response.ok) {
          return {
            answer: null,
            results: [],
            note: `Web search failed (${response.status}). Say you could not look that up.`,
          };
        }
        const data = (await response.json()) as {
          answer?: string | null;
          results?: { title?: string; url?: string; content?: string }[];
        };
        return {
          answer: typeof data.answer === "string" ? data.answer : null,
          results: (data.results ?? []).slice(0, 4).map((r) => ({
            title: r.title ?? "",
            url: r.url ?? "",
            snippet: (r.content ?? "").slice(0, 300),
          })),
          note: "External web results, not official records. Say where this came from.",
        };
      } catch {
        return {
          answer: null,
          results: [],
          note: "Web search failed. Say you could not look that up.",
        };
      }
    },
  });

  return {
    searchProjects,
    getProjectDetail,
    rankProjects: rankProjectsTool,
    getResaleMedian,
    listExercises,
    getTownOverview,
    webSearch,
  };
}

export type PlannerTools = InferUITools<ReturnType<typeof createPlannerTools>>;
