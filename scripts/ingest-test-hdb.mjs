#!/usr/bin/env node
/**
 * Standalone fetch+parse test for the HDB BTO launch ingestion
 * (convex/ingest/hdb.ts). Performs NO Convex writes and prints what the
 * crawler would see: robots verdict, live-launch signal, per-quarter file
 * availability, parsed exercises/projects, and which projects are new vs the
 * hand-maintained seed.
 *
 * Usage: node scripts/ingest-test-hdb.mjs
 *
 * Request budget: 1 robots.txt + 1 launch-API POST + ~9 file GETs, serial
 * with gaps. Parser logic mirrors convex/ingest/hdb.ts — keep them in sync.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const APPRATES_BASE = "https://services-homes.hdb.gov.sg/sales/files/apprates";
const LAUNCH_API = "https://services-homes.hdb.gov.sg/api/bp29/sf/v1";
const ROBOTS_URL = "https://services-homes.hdb.gov.sg/robots.txt";
const USER_AGENT =
  "BTOProjects.sg launch-ingest/1.0 (BTO launch data aggregator; low-volume scheduled fetch)";
const BTO_CANDIDATE_MONTHS = ["02", "06", "07", "10"];
const REQUEST_GAP_MS = 400;
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeName = (raw) => raw.trim().toLowerCase().replace(/\s+/g, " ");

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function toClassification(raw) {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  if (n === "standard") return "Standard";
  if (n === "plus") return "Plus";
  if (n === "prime") return "Prime";
  return null;
}

function mapFlatType(raw) {
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
      return null;
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
];

function sgtNow() {
  const sgt = new Date(Date.now() + SGT_OFFSET_MS);
  return { year: sgt.getUTCFullYear(), month: sgt.getUTCMonth() + 1 };
}

function candidateQuarters(liveQuarter) {
  const { year, month } = sgtNow();
  const quarters = new Set();
  for (const y of [year, year - 1]) {
    for (const m of BTO_CANDIDATE_MONTHS) quarters.add(`${y}${m}`);
  }
  if (month >= 11) quarters.add(`${year + 1}02`);
  if (liveQuarter && /^\d{6}$/.test(liveQuarter)) quarters.add(liveQuarter);
  return [...quarters].sort((a, b) => (a < b ? 1 : -1));
}

function parseAppRates(quarter, sourceUrl, json) {
  const projectsByKey = new Map();
  let flatTypeRowCount = 0;

  for (const estate of json.estate_list ?? []) {
    const town = estate.estate_name?.trim();
    if (!town) continue;
    for (const row of estate.flat_type_list ?? []) {
      flatTypeRowCount++;
      const listed = row.projects ?? [];
      const supply =
        typeof row.flat_supply === "number" && Number.isFinite(row.flat_supply)
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
      project.totalUnits = project.soleUnits.reduce((sum, u) => sum + u.supply, 0);
    }
  }

  const monthIndex = Number(quarter.slice(4, 6)) - 1;
  return {
    quarter,
    key: `${quarter.slice(0, 4)}-${quarter.slice(4, 6)}`,
    label: `${MONTH_NAMES[monthIndex] ?? quarter.slice(4, 6)} ${quarter.slice(0, 4)} BTO`,
    applicationStart: json.launch_start_date ?? null,
    applicationEnd: json.launch_end_date ?? null,
    isFinalUpdate: json.is_final_update === true,
    sourceUrl,
    projects,
    flatTypeRowCount,
  };
}

async function checkRobots() {
  const res = await fetch(ROBOTS_URL, { headers: { "User-Agent": USER_AGENT } });
  const body = await res.text();
  const allowsAll = /user-agent:\s*\*[\s\S]*?allow:\s*\//i.test(body);
  const disallowsApprates = /^disallow:\s*\/sales\/files/im.test(body);
  return {
    status: res.status,
    verdict:
      res.status === 200 && allowsAll && !disallowsApprates
        ? "ALLOWED (User-agent: * Allow: /; no /sales/files disallow)"
        : "REVIEW NEEDED",
    raw: body.trim(),
  };
}

async function detectLiveQuarter() {
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
    const body = await res.text();
    const match = /"launch_qtr"\s*:\s*"(\d{6})"/.exec(body);
    return { status: res.status, quarter: match?.[1] ?? null, body };
  } catch (error) {
    return { status: 0, quarter: null, body: String(error) };
  }
}

async function fetchAppRatesFile(quarter) {
  const url = `${APPRATES_BASE}/BTO${quarter}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    redirect: "manual",
  });
  if (res.status !== 200) return { quarter, url, status: res.status, json: null };
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { quarter, url, status: res.status, json: null };
  }
  const json = await res.json();
  if (!Array.isArray(json.estate_list)) return { quarter, url, status: res.status, json: null };
  return { quarter, url, status: res.status, json };
}

async function readSeedSlugs() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const seedPath = path.join(here, "..", "convex", "seedData.ts");
  const text = await readFile(seedPath, "utf8");
  return new Set([...text.matchAll(/"slug":\s*"([^"]+)"/g)].map((m) => m[1]));
}

function main() {
  return (async () => {
    console.log("=== HDB BTO launch ingestion — fetch+parse test ===\n");

    console.log("--- robots.txt (services-homes.hdb.gov.sg) ---");
    const robots = await checkRobots();
    console.log(`HTTP ${robots.status} — ${robots.verdict}`);
    console.log(robots.raw);
    console.log(
      "\n(note: www.hdb.gov.sg robots.txt also allows content paths, but its WAF",
    );
    console.log("403s non-browser agents — this source avoids www entirely.)\n");

    await sleep(REQUEST_GAP_MS);

    console.log("--- live launch signal (POST get-launch-availability) ---");
    const live = await detectLiveQuarter();
    console.log(`HTTP ${live.status} — live quarter: ${live.quarter ?? "none"}`);
    console.log(`body: ${live.body.slice(0, 200)}\n`);

    const quarters = candidateQuarters(live.quarter);
    console.log(`--- probing ${quarters.length} candidate quarters (newest first) ---`);

    const seedSlugs = await readSeedSlugs();
    const discovered = [];
    for (const quarter of quarters) {
      await sleep(REQUEST_GAP_MS);
      const file = await fetchAppRatesFile(quarter);
      if (!file.json) {
        console.log(`BTO${quarter}.json — HTTP ${file.status} (absent, skipped)`);
        continue;
      }
      const exercise = parseAppRates(file.quarter, file.url, file.json);
      discovered.push(exercise);
      console.log(`BTO${quarter}.json — HTTP 200, PARSED`);
    }

    console.log("\n--- parsed exercises ---");
    for (const exercise of discovered) {
      console.log(
        `\n${exercise.key} — ${exercise.label} [${exercise.isFinalUpdate ? "closed (final update)" : "open/in-progress"}]`,
      );
      console.log(
        `  application window: ${exercise.applicationStart ?? "?"} → ${exercise.applicationEnd ?? "?"}`,
      );
      console.log(`  source: ${exercise.sourceUrl}`);
      console.log(
        `  estate x flat-type rows: ${exercise.flatTypeRowCount}; projects: ${exercise.projects.length}`,
      );
      for (const project of exercise.projects) {
        const slug = slugify(project.name);
        const isNew = !seedSlugs.has(slug);
        console.log(
          `  ${isNew ? "[NEW] " : "[seed]"}${project.name} (${project.town}, ${project.classification ?? "classification unknown"})`,
        );
        for (const units of project.soleUnits) {
          console.log(
            `        sole row: ${units.flatType} → ${units.supply} units${units.combined ? " (combined label, verbatim)" : ""}`,
          );
        }
        if (project.hasSharedRows) {
          console.log("        shared rows present — per-project split not published, skipped");
        }
        console.log(
          `        totalUnits fact: ${project.totalUnits ?? "not attributable"}`,
        );
      }
    }

    const newProjects = discovered.flatMap((e) =>
      e.projects.filter((p) => !seedSlugs.has(slugify(p.name))),
    );
    console.log("\n--- summary ---");
    console.log(`exercises parsed: ${discovered.length}`);
    console.log(
      `projects discovered: ${discovered.reduce((n, e) => n + e.projects.length, 0)} ` +
        `(${newProjects.length} new vs seed: ${newProjects.map((p) => p.name).join(", ") || "none"})`,
    );
  })();
}

main().catch((error) => {
  console.error("test script failed:", error);
  process.exitCode = 1;
});
