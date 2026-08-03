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
 * HDB BTO launch ingestion (Track W1).
 *
 * PRIMARY SOURCE (official, machine-readable, no auth):
 *   HDB Flat Portal static application-rate files
 *     https://services-homes.hdb.gov.sg/sales/files/apprates/BTO{YYYYMM}.json
 *   backing the public "Flat Supply & Applications Received" pages
 *     https://services-homes.hdb.gov.sg/sales/application-rate/BTO/{YYYYMM}
 *   robots.txt for services-homes.hdb.gov.sg is `User-agent: * Allow: /`
 *   (verified 3 Aug 2026). www.hdb.gov.sg robots also allows content paths but
 *   its WAF blocks non-browser agents — so we only touch services-homes.
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

/** Polite serial fetching: ~2.5 req/s max, ~10 requests per daily run. */
const REQUEST_GAP_MS = 400;

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

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

type Classification = "Standard" | "Plus" | "Prime";

interface SoleFlatTypeUnits {
  /** Our union label ("4-room") when mappable, else the verbatim source label. */
  flatType: string;
  supply: number;
  /** True for combined rows like "5-Room/3Gen" that our union cannot express. */
  combined: boolean;
}

interface DiscoveredProject {
  name: string;
  town: string;
  classification: Classification | null;
  /** Rows where this project is the ONLY project — supply is attributable. */
  soleUnits: SoleFlatTypeUnits[];
  /** Rows shared with other projects — supply split unpublished, skipped. */
  hasSharedRows: boolean;
  /** Sum of sole-row supply; null unless every row naming the project is sole. */
  totalUnits: number | null;
}

interface DiscoveredExercise {
  quarter: string; // "202606"
  key: string; // "2026-06" — matches exercises.key
  label: string; // "June 2026 BTO"
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

function toClassification(raw: string | undefined): Classification | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  if (n === "standard") return "Standard";
  if (n === "plus") return "Plus";
  if (n === "prime") return "Prime";
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

function exerciseKeyFor(quarter: string): string {
  return `${quarter.slice(0, 4)}-${quarter.slice(4, 6)}`;
}

function exerciseLabelFor(quarter: string): string {
  const monthIndex = Number(quarter.slice(4, 6)) - 1;
  const month = MONTH_NAMES[monthIndex] ?? quarter.slice(4, 6);
  return `${month} ${quarter.slice(0, 4)} BTO`;
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
 * Quarters to probe: regular BTO months for this and last SGT year, next
 * February once we are in Nov/Dec, plus any live quarter reported by the
 * launch API. Newest first so discovered[0] is the freshest source.
 */
function candidateQuarters(liveQuarter: string | null): string[] {
  const { year, month } = sgtNow();
  const quarters = new Set<string>();
  for (const y of [year, year - 1]) {
    for (const m of BTO_CANDIDATE_MONTHS) quarters.add(`${y}${m}`);
  }
  if (month >= 11) quarters.add(`${year + 1}02`);
  if (liveQuarter && /^\d{6}$/.test(liveQuarter)) quarters.add(liveQuarter);
  return [...quarters].sort((a, b) => (a < b ? 1 : -1));
}

function parseAppRates(
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

      for (const entry of listed) {
        const name = entry.project_name?.trim();
        if (!name) continue;
        const key = `${normalizeName(town)}::${normalizeName(name)}`;
        let project = projectsByKey.get(key);
        if (!project) {
          project = {
            name,
            town,
            classification: toClassification(entry.project_classification),
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
    if (!project.hasSharedRows && project.soleUnits.length > 0) {
      project.totalUnits = project.soleUnits.reduce(
        (sum, u) => sum + u.supply,
        0,
      );
    }
  }

  return {
    quarter,
    key: exerciseKeyFor(quarter),
    label: exerciseLabelFor(quarter),
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
  quarter: string,
): Promise<{ quarter: string; url: string; json: AppRatesFile } | null> {
  const url = `${APPRATES_BASE}/BTO${quarter}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    redirect: "manual",
  });
  if (res.status !== 200) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  const json = (await res.json()) as AppRatesFile;
  if (!Array.isArray(json.estate_list)) return null;
  return { quarter, url, json };
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
      const patch: { applicationEnd?: string; status?: "open" | "closed" } = {};
      if (!existing.applicationEnd && args.applicationEnd) {
        patch.applicationEnd = args.applicationEnd;
      }
      if (args.status === "closed" && existing.status !== "closed") {
        patch.status = "closed";
      } else if (args.status === "open" && existing.status === "upcoming") {
        patch.status = "open";
      }
      if (patch.applicationEnd !== undefined || patch.status !== undefined) {
        await ctx.db.patch("exercises", existing._id, patch);
      }
      return { id: existing._id, created: false };
    }
    const id = await ctx.db.insert("exercises", {
      key: args.key,
      label: args.label,
      type: "bto",
      status: args.status,
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
const createProjectShellReturns = v.object({
  id: v.id("projects"),
  created: v.boolean(),
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
      // 1. Discover which quarters to read: live API signal + fixed probes.
      const liveQuarter = await detectLiveQuarter();
      const quarters = candidateQuarters(liveQuarter);

      // 2. Fetch + parse, serially and politely. Missing quarters are normal.
      const discovered: DiscoveredExercise[] = [];
      for (const [index, quarter] of quarters.entries()) {
        if (index > 0) await sleep(REQUEST_GAP_MS);
        const file = await fetchAppRatesFile(quarter);
        if (!file) continue;
        try {
          discovered.push(parseAppRates(file.quarter, file.url, file.json));
        } catch (error) {
          summary.errors.push(
            `parse BTO${quarter}: ${error instanceof Error ? error.message : String(error)}`,
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
          status,
          ...(exercise.applicationEnd !== null
            ? { applicationEnd: exercise.applicationEnd }
            : {}),
        });
        if (exerciseResult.created) summary.rowsWritten++;

        for (const project of exercise.projects) {
          const town = townsByName.get(normalizeName(project.town));
          if (!town) {
            summary.errors.push(
              `unknown town "${project.town}" for project "${project.name}" (${exercise.key}) — skipped`,
            );
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
