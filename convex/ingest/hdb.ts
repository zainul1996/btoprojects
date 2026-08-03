import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { classificationValidator, exerciseStatusValidator } from "../schema";
import { emptySummary, INGEST_JOBS, type IngestRunSummary } from "./types";

/**
 * HDB BTO + SBF launch ingestion (Track W1; SBF added Aug 2026).
 *
 * PRIMARY SOURCE (official, machine-readable, no auth):
 *   HDB Flat Portal static application-rate files
 *     https://services-homes.hdb.gov.sg/sales/files/apprates/BTO{YYYYMM}.json
 *     https://services-homes.hdb.gov.sg/sales/files/apprates/SBF{YYYYMM}.json
 *   backing the public "Flat Supply & Applications Received" pages
 *     https://services-homes.hdb.gov.sg/sales/application-rate/BTO/{YYYYMM}
 *   robots.txt for services-homes.hdb.gov.sg is `User-agent: * Allow: /`
 *   (verified 3 Aug 2026). www.hdb.gov.sg robots also allows content paths but
 *   its WAF blocks non-browser agents — so we only touch services-homes.
 *
 * SBF NOTES:
 *   - Annual cadence since 2024: one SBF each February alongside the Feb BTO
 *     (Feb 2026: SBF202602.json = 4,320 units across 24 towns, matching the
 *     HDB press release). Composition is only revealed on launch day, so the
 *     "02" probe + live-quarter signal are the discovery mechanism.
 *   - SBF rows are town-level pools: project_name == estate_name and
 *     project_classification is usually "NA" (mapped to our "Unclassified";
 *     real Standard/Plus/Prime rows do appear for returned classified flats).
 *   - Flat types outside the BTO union (Community Care Apartment,
 *     "5-Room/3Gen", "5-Room/Executive") are recorded as verbatim facts,
 *     same convention as BTO combined rows.
 *   - Applicant counts per row are stored as facts (flatType.X.applicants) —
 *     SBF demand signal; BTO rows get the same treatment.
 *
 * SECONDARY SIGNAL (live-window detection):
 *   POST {LAUNCH_API}/get-launch-availability — the SPA's own endpoint; returns
 *   the active launch's `launch_qtr` during an application window and
 *   `{"code":2002}` ("no sales launch") otherwise. Lets us catch off-cycle
 *   exercises that the fixed month probe list would miss.
 *
 * KNOWN LIMITATIONS (loud by design — do not "fix" by fabricating):
 *   - A quarter's JSON only appears once the exercise OPENS; this source cannot
 *     discover announced-but-not-yet-launched exercises (e.g. town lists from
 *     HDB press releases).
 *   - `flat_supply` is per estate x flat-type row. When several projects share
 *     a row (e.g. Sembawang Deck + Sembawang Voyage 4-Room), the split between
 *     projects is NOT published here — those units are skipped, never guessed.
 *   - "5-Room/3Gen" combined rows cannot be mapped onto our flat-type union;
 *     their supply is recorded verbatim under field `flatType.5-Room/3Gen.units`.
 *   - No prices, no completion dates, no coordinates in this source.
 *   - Retention looks like recent exercises only (Oct 2025 file already 404s
 *     while Feb/Jun 2026 resolve) — history must be captured by running
 *     regularly, not by backfill.
 *
 * NO "use node" ON PURPOSE: this file exports an internalQuery and
 * internalMutations alongside the action, and Convex forbids queries/mutations
 * in "use node" files. Everything used here (global fetch, crypto.randomUUID)
 * is available in the default Convex action runtime, so the directive is
 * unnecessary. File ownership rules (Track W1) also confine this crawler to a
 * single new file.
 */

const APPRATES_BASE =
  "https://services-homes.hdb.gov.sg/sales/files/apprates";
const LAUNCH_API = "https://services-homes.hdb.gov.sg/api/bp29/sf/v1";

/** Honest, descriptive UA — verified working against services-homes (3 Aug 2026). */
const USER_AGENT =
  "BTOProjects.sg launch-ingest/1.0 (BTO launch data aggregator; low-volume scheduled fetch)";

/** Regular BTO months are Feb/Jun/Oct; "07" hedges mid-year slips (e.g. 2025). */
const BTO_CANDIDATE_MONTHS = ["02", "06", "07", "10"] as const;

/** SBF is annual since 2024, always alongside the February BTO. */
const SBF_CANDIDATE_MONTHS = ["02"] as const;

/** Polite serial fetching: ~2.5 req/s max, ~12 requests per daily run. */
const REQUEST_GAP_MS = 400;

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

type SaleKind = "bto" | "sbf";

/**
 * HDB's estate_name quirks → our towns table. "Kallang Whampoa" arrives
 * without the slash; "Jurong East/ West" is HDB's own lumping of two towns
 * and is kept verbatim (a matching towns row exists for it).
 */
const TOWN_ALIASES: Record<string, string> = {
  "kallang whampoa": "Kallang/Whampoa",
};

// ---------------------------------------------------------------------------
// Source payload shapes (all fields optional — parser must degrade, not throw)
// ---------------------------------------------------------------------------

interface AppRatesProject {
  project_name?: string;
  project_classification?: string;
}

interface AppRatesFlatTypeRow {
  flat_type?: string;
  projects?: AppRatesProject[];
  flat_supply?: number;
  total_applicant_no?: number;
  app_rates?: {
    elderly?: number | null;
    first_time_fam?: number | null;
    second_time_fam?: number | null;
    first_time_singles?: number | null;
  };
}

interface AppRatesEstate {
  estate_name?: string;
  flat_type_list?: AppRatesFlatTypeRow[];
}

interface AppRatesFile {
  display_datetime?: string;
  is_final_update?: boolean;
  launch_start_date?: string; // "2026-06-17"
  launch_end_date?: string; // "2026-06-24" — the application deadline
  estate_list?: AppRatesEstate[];
}

// ---------------------------------------------------------------------------
// Parsed model
// ---------------------------------------------------------------------------

type Classification = "Standard" | "Plus" | "Prime" | "Unclassified";

interface SoleFlatTypeUnits {
  /** Our union label ("4-room") when mappable, else the verbatim source label. */
  flatType: string;
  supply: number;
  /** total_applicant_no for the row; null when the source omits it. */
  applicants: number | null;
  /** True for combined rows like "5-Room/3Gen" that our union cannot express. */
  combined: boolean;
}

interface DiscoveredProject {
  name: string;
  town: string;
  classification: Classification | null;
  /**
   * SBF only: every classification label seen for this pool across rows.
   * A town pool is the SAME offering split by classification (NA + Prime…),
   * so the row's supply is the pool's supply — unlike BTO shared rows where
   * the split between different projects is unpublished.
   */
  classSet: Set<string>;
  /** Rows where this project is the ONLY project — supply is attributable. */
  soleUnits: SoleFlatTypeUnits[];
  /** Rows shared with other projects — supply split unpublished, skipped. */
  hasSharedRows: boolean;
  /** Sum of sole-row supply; null unless every row naming the project is sole. */
  totalUnits: number | null;
}

interface DiscoveredExercise {
  kind: SaleKind;
  quarter: string; // "202606"
  key: string; // "2026-06" for BTO, "2026-02-sbf" for SBF
  label: string; // "June 2026 BTO" / "February 2026 SBF"
  applicationStart: string | null;
  applicationEnd: string | null;
  isFinalUpdate: boolean;
  sourceUrl: string;
  projects: DiscoveredProject[];
  flatTypeRowCount: number;
}

// ---------------------------------------------------------------------------
// Pure helpers (keep in sync with scripts/ingest-test-hdb.mjs)
// ---------------------------------------------------------------------------

function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toClassification(
  raw: string | undefined,
  kind: SaleKind,
): Classification | "Unclassified" | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  if (n === "standard") return "Standard";
  if (n === "plus") return "Plus";
  if (n === "prime") return "Prime";
  // SBF town pools are published as "NA" — mixed or pre-classification flats.
  if (kind === "sbf" && (n === "na" || n === "n/a" || n === "unclassified")) {
    return "Unclassified";
  }
  return null;
}

/** Source flat-type label → our btoFlatTypeValidator label; null if unmappable. */
function mapFlatType(raw: string): string | null {
  const norm = raw.toLowerCase().replace(/[\s-]+/g, " ").trim();
  switch (norm) {
    case "2 room flexi":
      return "2-room Flexi";
    case "3 room":
      return "3-room";
    case "4 room":
      return "4-room";
    case "5 room":
      return "5-room";
    case "3gen":
      return "3Gen";
    default:
      return null; // e.g. "5-Room/3Gen" combined row
  }
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function exerciseKeyFor(kind: SaleKind, quarter: string): string {
  const base = `${quarter.slice(0, 4)}-${quarter.slice(4, 6)}`;
  return kind === "sbf" ? `${base}-sbf` : base;
}

function exerciseLabelFor(kind: SaleKind, quarter: string): string {
  const monthIndex = Number(quarter.slice(4, 6)) - 1;
  const month = MONTH_NAMES[monthIndex] ?? quarter.slice(4, 6);
  return `${month} ${quarter.slice(0, 4)} ${kind.toUpperCase()}`;
}

/** Current date parts in Singapore time (HDB quarters are SGT-based). */
function sgtNow(): { year: number; month: number; isoDate: string } {
  const sgt = new Date(Date.now() + SGT_OFFSET_MS);
  const year = sgt.getUTCFullYear();
  const month = sgt.getUTCMonth() + 1;
  const isoDate = sgt.toISOString().slice(0, 10);
  return { year, month, isoDate };
}

/**
 * Files to probe: regular BTO months + annual February SBF for this and last
 * SGT year, next February once we are in Nov/Dec, plus both kinds for any
 * live quarter reported by the launch API. Newest first so discovered[0] is
 * the freshest source.
 */
function candidateProbes(
  liveQuarter: string | null,
): { kind: SaleKind; quarter: string }[] {
  const { year, month } = sgtNow();
  const probes = new Map<string, { kind: SaleKind; quarter: string }>();
  const add = (kind: SaleKind, quarter: string) =>
    probes.set(`${kind}${quarter}`, { kind, quarter });

  for (const y of [year, year - 1]) {
    for (const m of BTO_CANDIDATE_MONTHS) add("bto", `${y}${m}`);
    for (const m of SBF_CANDIDATE_MONTHS) add("sbf", `${y}${m}`);
  }
  if (month >= 11) {
    add("bto", `${year + 1}02`);
    add("sbf", `${year + 1}02`);
  }
  if (liveQuarter && /^\d{6}$/.test(liveQuarter)) {
    add("bto", liveQuarter);
    add("sbf", liveQuarter);
  }
  return [...probes.values()].sort((a, b) =>
    a.quarter < b.quarter ? 1 : a.quarter > b.quarter ? -1 : a.kind < b.kind ? -1 : 1,
  );
}

function parseAppRates(
  kind: SaleKind,
  quarter: string,
  sourceUrl: string,
  json: AppRatesFile,
): DiscoveredExercise {
  const projectsByKey = new Map<string, DiscoveredProject>();
  let flatTypeRowCount = 0;

  for (const estate of json.estate_list ?? []) {
    const town = estate.estate_name?.trim();
    if (!town) continue;
    for (const row of estate.flat_type_list ?? []) {
      flatTypeRowCount++;
      const listed = row.projects ?? [];
      const supply =
        typeof row.flat_supply === "number" &&
        Number.isFinite(row.flat_supply)
          ? row.flat_supply
          : null;
      const rawType = row.flat_type?.trim() ?? "";
      const mappedType = rawType ? mapFlatType(rawType) : null;

      if (kind === "sbf") {
        // One pool per estate: SBF is sold by town x flat type, so every
        // row's flat_supply is the pool's supply — whatever the entries are
        // named (the same pool may appear several times per row with
        // different classifications, or as block-level names). Entries only
        // feed the classification set; unlike BTO shared rows there is no
        // unpublished split to guard against.
        const key = `${normalizeName(town)}::${normalizeName(town)}`;
        let project = projectsByKey.get(key);
        if (!project) {
          project = {
            name: town,
            town,
            classification: null, // finalized from classSet below
            classSet: new Set(),
            soleUnits: [],
            hasSharedRows: false,
            totalUnits: null,
          };
          projectsByKey.set(key, project);
        }
        for (const entry of listed) {
          const cls = toClassification(entry.project_classification, kind);
          project.classSet.add(cls ?? "Unclassified");
        }
        if (supply !== null && rawType) {
          project.soleUnits.push({
            flatType: mappedType ?? rawType,
            supply,
            applicants:
              typeof row.total_applicant_no === "number" &&
              Number.isFinite(row.total_applicant_no)
                ? row.total_applicant_no
                : null,
            combined: mappedType === null,
          });
        }
        continue;
      }

      for (const entry of listed) {
        const name = entry.project_name?.trim();
        if (!name) continue;
        const key = `${normalizeName(town)}::${normalizeName(name)}`;
        let project = projectsByKey.get(key);
        if (!project) {
          project = {
            name,
            town,
            classification: toClassification(entry.project_classification, kind),
            classSet: new Set(),
            soleUnits: [],
            hasSharedRows: false,
            totalUnits: null,
          };
          projectsByKey.set(key, project);
        }
        if (listed.length === 1 && supply !== null && rawType) {
          project.soleUnits.push({
            flatType: mappedType ?? rawType,
            supply,
            applicants:
              typeof row.total_applicant_no === "number" &&
              Number.isFinite(row.total_applicant_no)
                ? row.total_applicant_no
                : null,
            combined: mappedType === null,
          });
        } else if (listed.length > 1) {
          project.hasSharedRows = true;
        }
      }
    }
  }

  const projects = [...projectsByKey.values()];
  for (const project of projects) {
    if (kind === "sbf") {
      // One real classification only when the pool is uniform; anything
      // mixed (or NA anywhere) stays honestly "Unclassified".
      const real = [...project.classSet].filter((c) => c !== "Unclassified");
      project.classification =
        project.classSet.size === 1 && real.length === 1
          ? (real[0] as Classification)
          : "Unclassified";
    }
    if (!project.hasSharedRows && project.soleUnits.length > 0) {
      project.totalUnits = project.soleUnits.reduce(
        (sum, u) => sum + u.supply,
        0,
      );
    }
  }

  return {
    kind,
    quarter,
    key: exerciseKeyFor(kind, quarter),
    label: exerciseLabelFor(kind, quarter),
    applicationStart: json.launch_start_date ?? null,
    applicationEnd: json.launch_end_date ?? null,
    isFinalUpdate: json.is_final_update === true,
    sourceUrl,
    projects,
    flatTypeRowCount,
  };
}

// ---------------------------------------------------------------------------
// Network (action runtime fetch; serial + polite)
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch one quarter's file. Missing quarters redirect (302) to the SPA's 404
 * page — with redirect:"manual" we see the 302 and skip. A 200 with non-JSON
 * content-type is the same SPA fallback reached some other way; also skip.
 */
async function fetchAppRatesFile(
  kind: SaleKind,
  quarter: string,
): Promise<{ kind: SaleKind; quarter: string; url: string; json: AppRatesFile } | null> {
  const url = `${APPRATES_BASE}/${kind.toUpperCase()}${quarter}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    redirect: "manual",
  });
  if (res.status !== 200) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  const json = (await res.json()) as AppRatesFile;
  if (!Array.isArray(json.estate_list)) return null;
  return { kind, quarter, url, json };
}

/**
 * Ask the Flat Portal which launch is active right now. The success payload
 * shape is only observable during an application window, so the quarter is
 * harvested defensively from the raw body; any failure just means "no live
 * signal" and the fixed probe list still applies.
 */
async function detectLiveQuarter(): Promise<string | null> {
  try {
    const res = await fetch(`${LAUNCH_API}/get-launch-availability`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://services-homes.hdb.gov.sg",
        "Salesform-Id": crypto.randomUUID(),
      },
      body: "{}",
    });
    if (!res.ok) return null;
    const body = await res.text();
    const match = /"launch_qtr"\s*:\s*"(\d{6})"/.exec(body);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB adapters (internal only).
// ---------------------------------------------------------------------------

const listIngestContextArgs = {};
const listIngestContextReturns = v.object({
  exercises: v.array(
    v.object({
      _id: v.id("exercises"),
      key: v.string(),
      status: exerciseStatusValidator,
      applicationEnd: v.optional(v.string()),
    }),
  ),
  towns: v.array(
    v.object({
      _id: v.id("towns"),
      name: v.string(),
      region: v.string(),
      lat: v.number(),
      lng: v.number(),
    }),
  ),
  projects: v.array(
    v.object({
      _id: v.id("projects"),
      slug: v.string(),
      name: v.string(),
      townId: v.id("towns"),
    }),
  ),
});

/** Bounded lookup tables (exercises/towns/projects are small by nature). */
export const listIngestContext = internalQuery({
  args: listIngestContextArgs,
  returns: listIngestContextReturns,
  handler: async (ctx) => {
    const [exerciseRows, townRows, projectRows] = await Promise.all([
      ctx.db.query("exercises").take(500),
      ctx.db.query("towns").take(500),
      ctx.db.query("projects").take(2000),
    ]);
    return {
      exercises: exerciseRows.map((row) => ({
        _id: row._id,
        key: row.key,
        status: row.status,
        ...(row.applicationEnd !== undefined
          ? { applicationEnd: row.applicationEnd }
          : {}),
      })),
      towns: townRows.map((row) => ({
        _id: row._id,
        name: row.name,
        region: row.region,
        lat: row.lat,
        lng: row.lng,
      })),
      projects: projectRows.map((row) => ({
        _id: row._id,
        slug: row.slug,
        name: row.name,
        townId: row.townId,
      })),
    };
  },
});

const upsertExerciseArgs = {
  key: v.string(),
  label: v.string(),
  type: v.union(v.literal("bto"), v.literal("sbf")),
  status: exerciseStatusValidator,
  applicationEnd: v.optional(v.string()),
};
const upsertExerciseReturns = v.object({
  id: v.id("exercises"),
  created: v.boolean(),
});

/**
 * Insert a discovered exercise if its key is new. Existing rows are only ever
 * moved forward: fill a missing applicationEnd, and advance status along
 * upcoming → open → closed. A closed exercise is never reopened.
 */
export const upsertExercise = internalMutation({
  args: upsertExerciseArgs,
  returns: upsertExerciseReturns,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("exercises")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      const patch: {
        applicationEnd?: string;
        status?: "open" | "closed";
        isEstimate?: false;
      } = {};
      if (existing.isEstimate === true) {
        patch.isEstimate = false;
      }
      if (!existing.applicationEnd && args.applicationEnd) {
        patch.applicationEnd = args.applicationEnd;
      }
      if (args.status === "closed" && existing.status !== "closed") {
        patch.status = "closed";
      } else if (args.status === "open" && existing.status === "upcoming") {
        patch.status = "open";
      }
      if (
        patch.applicationEnd !== undefined ||
        patch.status !== undefined ||
        patch.isEstimate !== undefined
      ) {
        await ctx.db.patch("exercises", existing._id, patch);
      }
      return { id: existing._id, created: false };
    }
    const id = await ctx.db.insert("exercises", {
      key: args.key,
      label: args.label,
      type: args.type,
      status: args.status,
      isEstimate: false,
      ...(args.applicationEnd !== undefined
        ? { applicationEnd: args.applicationEnd }
        : {}),
    });
    return { id, created: true };
  },
});

const createProjectShellArgs = {
  slug: v.string(),
  name: v.string(),
  townId: v.id("towns"),
  exerciseId: v.id("exercises"),
  region: v.string(),
  classification: classificationValidator,
  description: v.string(),
  applicationDeadline: v.optional(v.string()),
  notes: v.optional(v.string()),
};

/**
 * Reconciliation for pre-seeded "announced" projects (e.g. the October 2026
 * working-title rows): when the real launch data arrives, upgrade the
 * announced row in place instead of creating a duplicate.
 *
 * Adoption is only automatic when the town has exactly ONE announced shell —
 * an unambiguous 1:1 match. Multi-shell towns (e.g. Bayshore I/II) are left
 * for human reconciliation and reported by the caller as conflicts, because
 * pairing without reliable per-project unit splits could swap identities.
 */
export const adoptAnnouncedShell = internalMutation({
  args: {
    exerciseId: v.id("exercises"),
    townId: v.id("towns"),
    slug: v.string(),
    name: v.string(),
    classification: classificationValidator,
    applicationDeadline: v.optional(v.string()),
  },
  returns: v.object({
    id: v.union(v.id("projects"), v.null()),
    ambiguous: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const announced = (
      await ctx.db
        .query("projects")
        .withIndex("by_exercise", (q) => q.eq("exerciseId", args.exerciseId))
        .collect()
    ).filter(
      (p) => p.townId === args.townId && p.lifecycleStatus === "announced",
    );

    if (announced.length === 0) return { id: null, ambiguous: false };
    if (announced.length > 1) return { id: null, ambiguous: true };

    const shell = announced[0]!;
    await ctx.db.patch("projects", shell._id, {
      slug: args.slug,
      name: args.name,
      classification: args.classification,
      lifecycleStatus: "launched",
      ...(args.applicationDeadline !== undefined
        ? { applicationDeadline: args.applicationDeadline }
        : {}),
      notes:
        `${shell.notes ?? ""}\nReconciled: launch ingestion adopted this announced row as ` +
        `"${args.name}" (working title was "${shell.name}"). Announced unit count kept; ` +
        `launch facts apply via projectFacts.`,
      updatedAt: Date.now(),
    });
    return { id: shell._id, ambiguous: false };
  },
});
const createProjectShellReturns = v.object({
  id: v.id("projects"),
  created: v.boolean(),
});

/**
 * SBF town-pool shell: one row per SBF exercise x town. Coordinates are the
 * town centroid (pools span the town, so area markers — never pins); wait is
 * 0 because many balance flats are completed or near completion; completion
 * stays "" because it varies per flat. Prices stay 0 until press-table
 * enrichment — the apprates source carries supply and demand, never prices.
 */
export const createSbfShell = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    townId: v.id("towns"),
    exerciseId: v.id("exercises"),
    region: v.string(),
    classification: classificationValidator,
    description: v.string(),
    lat: v.number(),
    lng: v.number(),
    totalUnits: v.number(),
    applicationDeadline: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: createProjectShellReturns,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      // Repair path: an earlier run may have written a husk (totalUnits 0)
      // before a parser fix — patch supply/classification forward.
      const patch: { totalUnits?: number; classification?: typeof args.classification } = {};
      if (existing.totalUnits !== args.totalUnits) patch.totalUnits = args.totalUnits;
      if (existing.classification !== args.classification) {
        patch.classification = args.classification;
      }
      if (patch.totalUnits !== undefined || patch.classification !== undefined) {
        await ctx.db.patch("projects", existing._id, {
          ...patch,
          updatedAt: Date.now(),
        });
      }
      return { id: existing._id, created: false };
    }
    const id = await ctx.db.insert("projects", {
      slug: args.slug,
      name: args.name,
      townId: args.townId,
      exerciseId: args.exerciseId,
      region: args.region,
      classification: args.classification,
      lifecycleStatus: "launched",
      saleType: "sbf",
      lat: args.lat,
      lng: args.lng,
      description: args.description,
      totalUnits: args.totalUnits,
      estimatedWaitMonths: 0,
      estimatedCompletion: "",
      nearestMrt: [],
      mrtWalkingMinutes: 0,
      ...(args.applicationDeadline !== undefined
        ? { applicationDeadline: args.applicationDeadline }
        : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
      updatedAt: Date.now(),
    });
    return { id, created: true };
  },
});

/**
 * Flat-type supply rows for an SBF town pool. Only union-mappable types land
 * here ("Community Care Apartment" etc. stay as verbatim facts). Prices are
 * 0 = TBC until launch-price enrichment; units patch forward when HDB
 * revises the file mid-window.
 */
export const upsertSbfFlatTypes = internalMutation({
  args: {
    projectId: v.id("projects"),
    rows: v.array(
      v.object({
        type: v.union(
          v.literal("2-room Flexi"),
          v.literal("3-room"),
          v.literal("4-room"),
          v.literal("5-room"),
          v.literal("3Gen"),
        ),
        units: v.number(),
      }),
    ),
  },
  returns: v.object({ inserted: v.number(), patched: v.number() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("flatTypes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const byType = new Map(existing.map((row) => [row.type, row]));
    let inserted = 0;
    let patched = 0;
    for (const row of args.rows) {
      const current = byType.get(row.type);
      if (!current) {
        await ctx.db.insert("flatTypes", {
          projectId: args.projectId,
          type: row.type,
          units: row.units,
          minPrice: 0,
          maxPrice: 0,
        });
        inserted++;
      } else if (current.units !== row.units) {
        await ctx.db.patch("flatTypes", current._id, { units: row.units });
        patched++;
      }
    }
    return { inserted, patched };
  },
});

/**
 * Create a minimal shell for a project the source clearly names but our DB
 * lacks. Required fields the source does not carry are explicit placeholders
 * (0 / "" / []) called out in `notes` — enrichment pipelines (geocode, price
 * research) own them from here. Idempotent by slug.
 */
export const createProjectShell = internalMutation({
  args: createProjectShellArgs,
  returns: createProjectShellReturns,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) return { id: existing._id, created: false };
    const id = await ctx.db.insert("projects", {
      slug: args.slug,
      name: args.name,
      townId: args.townId,
      exerciseId: args.exerciseId,
      region: args.region,
      classification: args.classification,
      lifecycleStatus: "launched",
      saleType: "bto",
      lat: 0,
      lng: 0,
      description: args.description,
      totalUnits: 0,
      estimatedWaitMonths: 0,
      estimatedCompletion: "",
      nearestMrt: [],
      mrtWalkingMinutes: 0,
      ...(args.applicationDeadline !== undefined
        ? { applicationDeadline: args.applicationDeadline }
        : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
      updatedAt: Date.now(),
    });
    return { id, created: true };
  },
});

// ---------------------------------------------------------------------------
// The crawl
// ---------------------------------------------------------------------------

interface FactToApply {
  field: string;
  value: string;
  note?: string;
}

/** "4,320"-style unit count for alert copy; falls back honestly when unknown. */
function totalUnitsLine(project: DiscoveredProject): string {
  const total =
    project.totalUnits ??
    (project.soleUnits.length > 0
      ? project.soleUnits.reduce((sum, u) => sum + u.supply, 0)
      : null);
  return total === null ? "An unpublished number of" : total.toLocaleString("en-SG");
}

export const run = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    summary: v.object({
      jobName: v.string(),
      rowsFetched: v.number(),
      rowsWritten: v.number(),
      factsInserted: v.number(),
      factsUnchanged: v.number(),
      factsConflicts: v.number(),
      errors: v.array(v.string()),
    }),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const summary: IngestRunSummary = emptySummary(INGEST_JOBS.hdbLaunches);
    const jobId = await ctx.runMutation(internal.ingest.lib.startJob, {
      source: INGEST_JOBS.hdbLaunches,
    });

    try {
      // 1. Discover which files to read: live API signal + fixed probes.
      const liveQuarter = await detectLiveQuarter();
      const probes = candidateProbes(liveQuarter);

      // 2. Fetch + parse, serially and politely. Missing quarters are normal.
      const discovered: DiscoveredExercise[] = [];
      for (const [index, probe] of probes.entries()) {
        if (index > 0) await sleep(REQUEST_GAP_MS);
        const file = await fetchAppRatesFile(probe.kind, probe.quarter);
        if (!file) continue;
        try {
          discovered.push(
            parseAppRates(file.kind, file.quarter, file.url, file.json),
          );
        } catch (error) {
          summary.errors.push(
            `parse ${probe.kind.toUpperCase()}${probe.quarter}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      summary.rowsFetched = discovered.reduce(
        (total, ex) => total + ex.flatTypeRowCount,
        0,
      );

      if (discovered.length === 0) {
        // Not a failure: between exercises with no retained files this is the
        // expected steady state. No sources row — nothing was retrieved.
        await ctx.runMutation(internal.ingest.lib.finishJob, {
          jobId,
          status: "success",
          stats: { ...summary, note: "no application-rate files available" },
        });
        console.log(
          JSON.stringify({
            fn: "ingest/hdb.run",
            ...summary,
            note: "no files",
          }),
        );
        return { ok: true, summary };
      }

      // 3. One sources row per run — the newest file retrieved (provenance
      //    for the run; per-fact notes carry their own quarter's file URL).
      const sourceId = await ctx.runMutation(internal.ingest.lib.upsertSource, {
        url: discovered[0].sourceUrl,
        kind: "hdb",
        publisher: "HDB — HDB Flat Portal (services-homes.hdb.gov.sg)",
        title:
          "Flat Supply & Applications Received — BTO application-rate JSON",
      });

      // 4. Match against what we already know.
      const context = await ctx.runQuery(internal.ingest.hdb.listIngestContext, {});
      const townsByName = new Map(
        context.towns.map((t) => [normalizeName(t.name), t]),
      );
      const projectsByNameTown = new Map(
        context.projects.map((p) => [`${normalizeName(p.name)}|${p.townId}`, p]),
      );
      const takenSlugs = new Set(context.projects.map((p) => p.slug));

      // 5. Upsert exercises, then match/create projects and apply facts.
      for (const exercise of discovered) {
        const { isoDate } = sgtNow();
        const status: "upcoming" | "open" | "closed" = exercise.isFinalUpdate
          ? "closed"
          : exercise.applicationStart && exercise.applicationStart > isoDate
            ? "upcoming"
            : "open";
        const exerciseResult = await ctx.runMutation(internal.ingest.hdb.upsertExercise, {
          key: exercise.key,
          label: exercise.label,
          type: exercise.kind,
          status,
          ...(exercise.applicationEnd !== null
            ? { applicationEnd: exercise.applicationEnd }
            : {}),
        });
        if (exerciseResult.created) summary.rowsWritten++;

        for (const project of exercise.projects) {
          const canonicalTown = TOWN_ALIASES[normalizeName(project.town)] ?? project.town;
          const town = townsByName.get(normalizeName(canonicalTown));
          if (!town) {
            summary.errors.push(
              `unknown town "${project.town}" for project "${project.name}" (${exercise.key}) — skipped`,
            );
            continue;
          }

          // SBF town-pool path: one project row per exercise x town, named
          // for the pool, keyed by slug so re-runs are idempotent. The shell
          // mutation is ALWAYS invoked: beyond insert it repairs totalUnits /
          // classification forward when the parser improves (husks from
          // earlier runs must not linger).
          if (exercise.kind === "sbf") {
            const slug = `sbf-${exercise.key.replace("-sbf", "")}-${slugify(town.name)}`;
            if (!project.classification) {
              summary.errors.push(
                `new SBF pool "${project.name}" (${project.town}, ${exercise.key}) has no usable classification — shell skipped`,
              );
              continue;
            }
            const totalUnits =
              project.totalUnits ??
              project.soleUnits.reduce((sum, u) => sum + u.supply, 0);
            const shell = await ctx.runMutation(internal.ingest.hdb.createSbfShell, {
              slug,
              name: `${town.name} balance flats`,
              townId: town._id,
              exerciseId: exerciseResult.id,
              region: town.region,
              classification: project.classification,
              description:
                `Balance flats in ${town.name} offered in the ${exercise.label} exercise. ` +
                `SBF flats are sold by town and flat type, not by project; individual flats vary in block, ` +
                `remaining lease, price and completion date, and many are completed or nearing completion.`,
              lat: town.lat,
              lng: town.lng,
              totalUnits,
              ...(exercise.applicationEnd !== null
                ? { applicationDeadline: exercise.applicationEnd }
                : {}),
              notes:
                `Auto-created SBF town pool from HDB Flat Portal application-rate data (SBF${exercise.quarter}). ` +
                `lat/lng are the town centroid (pool spans the town). Prices are TBC — ` +
                `this source publishes supply and application counts, never prices.`,
            });
            const projectId = shell.id;
            if (shell.created) {
              summary.rowsWritten++;
              // Town watchers hear about new SBF supply in their town.
              await ctx.runMutation(internal.alertsEngine.notifyProjectUpdate, {
                projectId,
                title: `SBF balance flats in ${town.name}`,
                body:
                  `${totalUnitsLine(project)} balance flats in ${town.name} were offered in the ${exercise.label} exercise. ` +
                  `SBF flats often mean much shorter waits than BTO. Check the pool before the window closes.`,
              });
            }

            const mappable = project.soleUnits.filter(
              (u): u is SoleFlatTypeUnits & { flatType: "2-room Flexi" | "3-room" | "4-room" | "5-room" | "3Gen" } =>
                !u.combined,
            );
            if (mappable.length > 0) {
              await ctx.runMutation(internal.ingest.hdb.upsertSbfFlatTypes, {
                projectId,
                rows: mappable.map((u) => ({ type: u.flatType, units: u.supply })),
              });
            }

            const facts: FactToApply[] = [];
            if (project.classification) {
              facts.push({
                field: "classification",
                value: project.classification,
                note: `SBF${exercise.quarter} application-rate file`,
              });
            }
            if (exercise.applicationEnd) {
              facts.push({
                field: "applicationDeadline",
                value: exercise.applicationEnd,
                note: `application window ${exercise.applicationStart ?? "unknown"} → ${exercise.applicationEnd} (${exercise.key})`,
              });
            }
            if (project.totalUnits !== null) {
              facts.push({
                field: "totalUnits",
                value: String(project.totalUnits),
                note: `sum of estate rows in SBF${exercise.quarter}`,
              });
            }
            for (const units of project.soleUnits) {
              facts.push({
                field: `flatType.${units.flatType}.units`,
                value: String(units.supply),
                note: units.combined
                  ? `combined "${units.flatType}" estate row as published in SBF${exercise.quarter} — split by flat type not published`
                  : `estate row in SBF${exercise.quarter}`,
              });
              if (units.applicants !== null) {
                facts.push({
                  field: `flatType.${units.flatType}.applicants`,
                  value: String(units.applicants),
                  note: `applications received for the "${units.flatType}" row in SBF${exercise.quarter}`,
                });
              }
            }

            for (const fact of facts) {
              const result = await ctx.runMutation(
                internal.ingest.lib.applyProjectFact,
                {
                  projectId,
                  field: fact.field,
                  value: fact.value,
                  confidence: "official",
                  extractionMethod: "parser",
                  sourceId,
                  ...(fact.note !== undefined ? { note: fact.note } : {}),
                },
              );
              if (result === "inserted") summary.factsInserted++;
              else if (result === "unchanged") summary.factsUnchanged++;
              else summary.factsConflicts++;
            }
            continue;
          }

          let projectId = projectsByNameTown.get(
            `${normalizeName(project.name)}|${town._id}`,
          )?._id;

          if (!projectId) {
            // Genuinely new project — create a shell only when the source
            // states its classification; otherwise we cannot fill required
            // fields honestly.
            if (!project.classification) {
              summary.errors.push(
                `new project "${project.name}" (${project.town}, ${exercise.key}) has no usable classification — shell skipped`,
              );
              continue;
            }
            let slug = slugify(project.name);
            if (takenSlugs.has(slug)) slug = `${slug}-${slugify(town.name)}`;
            let suffix = 2;
            while (takenSlugs.has(slug)) {
              slug = `${slugify(project.name)}-${suffix++}`;
            }

            // Reconciliation: a pre-seeded "announced" row for this
            // exercise+town gets adopted (identity upgraded in place) instead
            // of duplicated. Ambiguous multi-shell towns defer to human
            // reconciliation with a loud job note.
            const adoption = await ctx.runMutation(internal.ingest.hdb.adoptAnnouncedShell, {
              exerciseId: exerciseResult.id,
              townId: town._id,
              slug,
              name: project.name,
              classification: project.classification,
              ...(exercise.applicationEnd !== null
                ? { applicationDeadline: exercise.applicationEnd }
                : {}),
            });
            if (adoption.ambiguous) {
              summary.errors.push(
                `reconcile needed: "${project.name}" (${project.town}, ${exercise.key}) matches multiple announced shells — created new row, human merge required`,
              );
            }
            if (adoption.id) {
              projectId = adoption.id;
              takenSlugs.add(slug);
              projectsByNameTown.set(`${normalizeName(project.name)}|${town._id}`, {
                _id: adoption.id,
                slug,
                name: project.name,
                townId: town._id,
              });
              summary.rowsWritten++;
              console.log(
                JSON.stringify({
                  fn: "ingest/hdb.run",
                  adopted: project.name,
                  town: town.name,
                  exercise: exercise.key,
                }),
              );
            }

            if (!projectId) {
              const shell = await ctx.runMutation(internal.ingest.hdb.createProjectShell, {
                slug,
                name: project.name,
                townId: town._id,
                exerciseId: exerciseResult.id,
                region: town.region,
                classification: project.classification,
                description:
                  `${project.name} is a ${project.classification}-classification BTO project in ${town.name}, ` +
                  `offered in the ${exercise.label} sales exercise. ` +
                  `Shell record from automated HDB launch ingestion; units, pricing, coordinates and completion dates pending enrichment.`,
                ...(exercise.applicationEnd !== null
                  ? { applicationDeadline: exercise.applicationEnd }
                  : {}),
                notes:
                  `Auto-created shell from HDB Flat Portal application-rate data (BTO${exercise.quarter}). ` +
                  `lat/lng/totalUnits/estimatedWaitMonths/estimatedCompletion are placeholders pending geocode and launch-detail enrichment.`,
              });
              projectId = shell.id;
              takenSlugs.add(slug);
              projectsByNameTown.set(`${normalizeName(project.name)}|${town._id}`, {
                _id: shell.id,
                slug,
                name: project.name,
                townId: town._id,
              });
              if (shell.created) summary.rowsWritten++;
            }
          }

          // Facts: only what the source actually states, all confidence
          // "official" (HDB's own published figures) via deterministic parser.
          const facts: FactToApply[] = [];
          if (project.classification) {
            facts.push({
              field: "classification",
              value: project.classification,
              note: `BTO${exercise.quarter} application-rate file`,
            });
          }
          if (exercise.applicationEnd) {
            facts.push({
              field: "applicationDeadline",
              value: exercise.applicationEnd,
              note: `application window ${exercise.applicationStart ?? "unknown"} → ${exercise.applicationEnd} (${exercise.key})`,
            });
          }
          if (project.totalUnits !== null) {
            facts.push({
              field: "totalUnits",
              value: String(project.totalUnits),
              note: `sum of single-project estate rows in BTO${exercise.quarter}`,
            });
          }
          for (const units of project.soleUnits) {
            facts.push({
              field: `flatType.${units.flatType}.units`,
              value: String(units.supply),
              note: units.combined
                ? `combined "${units.flatType}" estate row as published in BTO${exercise.quarter} — split by flat type not published`
                : `single-project estate row in BTO${exercise.quarter}`,
            });
            if (units.applicants !== null) {
              facts.push({
                field: `flatType.${units.flatType}.applicants`,
                value: String(units.applicants),
                note: `applications received for the "${units.flatType}" row in BTO${exercise.quarter}`,
              });
            }
          }

          for (const fact of facts) {
            const result = await ctx.runMutation(
              internal.ingest.lib.applyProjectFact,
              {
                projectId,
                field: fact.field,
                value: fact.value,
                confidence: "official",
                extractionMethod: "parser",
                sourceId,
                ...(fact.note !== undefined ? { note: fact.note } : {}),
              },
            );
            if (result === "inserted") summary.factsInserted++;
            else if (result === "unchanged") summary.factsUnchanged++;
            else summary.factsConflicts++;
          }
        }
      }

      await ctx.runMutation(internal.ingest.lib.finishJob, {
        jobId,
        status: "success",
        stats: { ...summary },
      });
      console.log(JSON.stringify({ fn: "ingest/hdb.run", ...summary }));
      return { ok: true, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.ingest.lib.finishJob, {
        jobId,
        status: "failed",
        error: message,
      });
      console.log(
        JSON.stringify({ fn: "ingest/hdb.run", ok: false, error: message }),
      );
      return { ok: false, summary, error: message };
    }
  },
});
