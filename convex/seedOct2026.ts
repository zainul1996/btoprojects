import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * One-off seed: October 2026 BTO exercise, officially announced by HDB on
 * 17 Jun 2026 (7,970 flats, 7 projects, 6 towns).
 *
 * What is official: towns, unit counts, and the flat-type mixes listed below.
 * What is NOT official yet (published at launch in October): project names,
 * prices, classifications, site plans, application window dates.
 *
 * Honest-by-construction:
 * - names are working titles, `notes` says so on every row
 * - classification values are analyst expectations → fact confidence
 *   "estimated", never "official"
 * - lat/lng are MRT-anchored approximations → fact confidence "estimated"
 * - zero flatTypes rows (schema requires prices; prices unknown → no rows,
 *   UI renders the "prices at launch" state)
 * - lifecycleStatus "announced" keeps these out of planner rankings and
 *   lets the map render area markers instead of point pins
 *
 * Idempotent: skips any slug that already exists.
 * Run: npx convex run seedOct2026:run
 */

interface AnnouncedProject {
  slug: string;
  name: string;
  town: string;
  classification: "Standard" | "Plus" | "Prime";
  totalUnits: number;
  lat: number;
  lng: number;
  nearestMrt: string[];
  description: string;
  notes: string;
  /** Official mix as announced, when fully broken out; display-only. */
  flatMix?: string;
}

const ANNOUNCED: AnnouncedProject[] = [
  {
    slug: "oct-2026-bayshore-1",
    name: "Bedok (Bayshore) I",
    town: "Bedok",
    classification: "Prime",
    totalUnits: 860,
    lat: 1.31312,
    lng: 103.94231,
    nearestMrt: ["Bayshore (TE29)"],
    description:
      "Smaller of two October 2026 projects along Bayshore Drive beside Bayshore MRT, in the new waterfront Bayshore precinct near East Coast Park.",
    flatMix: "350 × 2-room Flexi, 510 × 4-room",
    notes:
      "Working title — HDB publishes the official name, prices, classification and site plan at the October 2026 launch. Announced 17 Jun 2026. Location is MRT-anchored and approximate. Nearly half the flats are 2-room Flexi, open to singles.",
  },
  {
    slug: "oct-2026-bayshore-2",
    name: "Bedok (Bayshore) II",
    town: "Bedok",
    classification: "Prime",
    totalUnits: 1640,
    lat: 1.31184,
    lng: 103.94125,
    nearestMrt: ["Bayshore (TE29)"],
    description:
      "Larger of two October 2026 projects along Bayshore Drive beside Bayshore MRT, in the new waterfront Bayshore precinct near East Coast Park.",
    flatMix: "890 × 2-room Flexi, 90 × 3-room, 660 × 4-room",
    notes:
      "Working title — HDB publishes the official name, prices, classification and site plan at the October 2026 launch. Announced 17 Jun 2026. Location is MRT-anchored and approximate.",
  },
  {
    slug: "oct-2026-caldecott",
    name: "Toa Payoh (Caldecott)",
    town: "Toa Payoh",
    classification: "Prime",
    totalUnits: 1430,
    lat: 1.33735,
    lng: 103.83954,
    nearestMrt: ["Caldecott (CC17/TE9)"],
    description:
      "October 2026 project next to Caldecott MRT interchange in Toa Payoh, including roughly 260 Community Care Apartments for seniors.",
    notes:
      "Working title — HDB publishes the official name, prices, classification and site plan at the October 2026 launch. Announced 17 Jun 2026. Location is MRT-anchored and approximate. Total includes ~260 Community Care Apartments; BTO flat-type mix not yet broken out.",
  },
  {
    slug: "oct-2026-mattar",
    name: "Geylang (Mattar)",
    town: "Geylang",
    classification: "Plus",
    totalUnits: 440,
    lat: 1.32688,
    lng: 103.88325,
    nearestMrt: ["Mattar (DT25)"],
    description:
      "Smallest project of the October 2026 exercise, near Mattar MRT in Geylang — a rare small launch in a mature estate.",
    notes:
      "Working title — HDB publishes the official name, prices, classification and site plan at the October 2026 launch. Announced 17 Jun 2026. Location is MRT-anchored and approximate. Flat-type mix not yet broken out.",
  },
  {
    slug: "oct-2026-chencharu",
    name: "Yishun (Chencharu)",
    town: "Yishun",
    classification: "Standard",
    totalUnits: 1580,
    lat: 1.419,
    lng: 103.82707,
    nearestMrt: ["Khatib (NS14)"],
    description:
      "October 2026 project in the new Chencharu estate in Yishun, near Khatib MRT — the largest 5-room supply of this exercise.",
    notes:
      "Working title — HDB publishes the official name, prices, classification and site plan at the October 2026 launch. Announced 17 Jun 2026. Location is anchored to the Chencharu area and approximate. Flat-type mix not yet broken out.",
  },
  {
    slug: "oct-2026-sembawang-north",
    name: "Sembawang North",
    town: "Sembawang",
    classification: "Standard",
    totalUnits: 1310,
    lat: 1.46273,
    lng: 103.82502,
    nearestMrt: ["Canberra (NS12)"],
    description:
      "October 2026 project in the new Sembawang North estate — the first BTO launch for this precinct.",
    flatMix: "330 × 2-room Flexi, 100 × 3-room, 460 × 4-room, 420 × 5-room",
    notes:
      "Working title — HDB publishes the official name, prices, classification and site plan at the October 2026 launch. Announced 17 Jun 2026. Location is anchored to the Sembawang North area and approximate.",
  },
  {
    slug: "oct-2026-tengah-garden",
    name: "Tengah (Garden Avenue)",
    town: "Tengah",
    classification: "Standard",
    totalUnits: 710,
    lat: 1.35812,
    lng: 103.72615,
    nearestMrt: ["Tengah Garden Avenue (JS4)"],
    description:
      "October 2026 project around Tengah Garden Avenue in Tengah's Garden district — the first Tengah launch since October 2023.",
    notes:
      "Working title — HDB publishes the official name, prices, classification and site plan at the October 2026 launch. Announced 17 Jun 2026. Location is anchored to Tengah Garden Avenue and approximate. Mix includes 200 × 5-room and 50 × 3Gen; remainder not yet broken out.",
  },
];

const ANNOUNCEMENT_SOURCE = {
  url: "https://www.straitstimes.com/singapore/housing/bto-projects-in-bayshore-tengah-among-nearly-8000-flats-to-be-launched-in-october",
  kind: "publisher" as const,
  publisher: "The Straits Times (reporting HDB's 17 Jun 2026 announcement)",
  title: "BTO projects in Bayshore, Tengah among nearly 8,000 flats to be launched in October",
};

export const run = internalMutation({
  args: {},
  returns: v.object({
    exerciseId: v.string(),
    inserted: v.array(v.string()),
    skipped: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    const exercise = await ctx.db
      .query("exercises")
      .withIndex("by_key", (q) => q.eq("key", "2026-10"))
      .unique();
    let exerciseId: Id<"exercises">;
    if (exercise) {
      exerciseId = exercise._id;
    } else {
      exerciseId = await ctx.db.insert("exercises", {
        key: "2026-10",
        label: "October 2026 BTO",
        type: "bto",
        status: "upcoming",
      });
    }

    const sourceId = await ctx.db.insert("sources", {
      url: ANNOUNCEMENT_SOURCE.url,
      kind: ANNOUNCEMENT_SOURCE.kind,
      publisher: ANNOUNCEMENT_SOURCE.publisher,
      title: ANNOUNCEMENT_SOURCE.title,
      retrievedAt: now,
    });

    const inserted: string[] = [];
    const skipped: string[] = [];

    for (const p of ANNOUNCED) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_slug", (q) => q.eq("slug", p.slug))
        .unique();
      if (existing) {
        skipped.push(p.slug);
        continue;
      }

      const town = await ctx.db
        .query("towns")
        .withIndex("by_name", (q) => q.eq("name", p.town))
        .unique();
      if (!town) throw new Error(`Town not seeded: ${p.town}`);

      const projectId = await ctx.db.insert("projects", {
        slug: p.slug,
        name: p.name,
        townId: town._id,
        exerciseId,
        region: town.region,
        classification: p.classification,
        lifecycleStatus: "announced",
        lat: p.lat,
        lng: p.lng,
        description: p.description,
        totalUnits: p.totalUnits,
        estimatedWaitMonths: 0,
        estimatedCompletion: "",
        nearestMrt: p.nearestMrt,
        mrtWalkingMinutes: 0,
        notes: p.notes,
        updatedAt: now,
      });

      await ctx.db.insert("projectSources", { projectId, sourceId });

      const facts: Array<{
        field: string;
        value: string;
        confidence: "official" | "estimated";
        note: string;
      }> = [
        {
          field: "totalUnits",
          value: String(p.totalUnits),
          confidence: "official",
          note: "Unit count from HDB's 17 Jun 2026 announcement.",
        },
        {
          field: "classification",
          value: p.classification,
          confidence: "estimated",
          note: "Analyst expectation from launch previews — HDB confirms classification at launch.",
        },
        {
          field: "lat",
          value: String(p.lat),
          confidence: "estimated",
          note: "MRT-anchored approximation; exact site plan at launch.",
        },
        {
          field: "lng",
          value: String(p.lng),
          confidence: "estimated",
          note: "MRT-anchored approximation; exact site plan at launch.",
        },
      ];
      if (p.flatMix) {
        facts.push({
          field: "flatMix",
          value: p.flatMix,
          confidence: "official",
          note: "Flat-type mix from HDB's 17 Jun 2026 announcement.",
        });
      }

      for (const f of facts) {
        await ctx.db.insert("projectFacts", {
          projectId,
          field: f.field,
          value: f.value,
          confidence: f.confidence,
          extractionMethod: "research",
          sourceId,
          retrievedAt: now,
          effectiveDate: "2026-06-17",
          note: f.note,
        });
      }

      inserted.push(p.slug);
    }

    return { exerciseId, inserted, skipped };
  },
});
