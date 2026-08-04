import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATASET_ID = "d_b39d3a0871985372d7e1637193335da5";
const DATASET_URL = `https://data.gov.sg/datasets/${DATASET_ID}/view`;
const API_BASE = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}`;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(SCRIPT_DIR, "../docs/seed/mrt.json");
const OUTPUT_PATH = resolve(
  SCRIPT_DIR,
  "../public/data/amenities/train-stations.json",
);

function requiredRetrievalTime(argv) {
  const index = argv.indexOf("--retrieved-at");
  const raw = index >= 0 ? argv[index + 1] : undefined;
  if (!raw) {
    throw new Error(
      "Usage: node scripts/sync-train-stations.mjs --retrieved-at <ISO timestamp>",
    );
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("--retrieved-at must be a valid ISO timestamp");
  }
  return parsed.toISOString();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "BTOProjects.sg amenity-sync/1.0" },
  });
  if (!response.ok) {
    throw new Error(`data.gov.sg request failed with HTTP ${response.status}`);
  }
  return await response.json();
}

async function downloadUrl() {
  const initiated = await fetchJson(`${API_BASE}/initiate-download`);
  if (initiated.code !== 0) {
    throw new Error(initiated.errorMsg || "Unable to initiate dataset download");
  }
  if (initiated.data?.url) return initiated.data.url;

  for (let attempt = 0; attempt < 10; attempt++) {
    const polled = await fetchJson(`${API_BASE}/poll-download`);
    if (polled.code === 0 && polled.data?.url) return polled.data.url;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error("Dataset download did not become ready after 10 polls");
}

function modeFor(officialName) {
  if (/\sMRT STATION$/i.test(officialName)) return "mrt";
  if (/\sLRT STATION$/i.test(officialName)) return "lrt";
  return "unknown";
}

function baseName(officialName) {
  return officialName.replace(/\s+(MRT|LRT) STATION$/i, "").trim();
}

function normalizedName(name) {
  return baseName(String(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function displayName(officialName) {
  const base = baseName(officialName);
  if (/^[A-Z]+\d+$/.test(base)) return base;
  return base
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, prefix, letter) =>
      `${prefix}${letter.toUpperCase()}`,
    );
}

function stationId(officialName) {
  return officialName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sourceUpdatedAt(raw) {
  if (typeof raw !== "string" || !/^\d{14}$/.test(raw)) return undefined;
  const value = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` +
    `T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}+08:00`;
  return Number.isFinite(new Date(value).getTime()) ? value : undefined;
}

const retrievedAt = requiredRetrievalTime(process.argv.slice(2));
const [geojson, seedText] = await Promise.all([
  fetchJson(await downloadUrl()),
  readFile(SEED_PATH, "utf8"),
]);
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  throw new Error("Station exit download is not a GeoJSON FeatureCollection");
}
const seedStations = JSON.parse(seedText);
const seedByName = new Map(
  seedStations.map((station) => [normalizedName(station.name), station]),
);

const skipped = { invalidIdentity: 0, invalidGeometry: 0, skippedCodeOnly: 0 };
const seenExitIds = new Set();
const groups = new Map();
for (const feature of geojson.features) {
  const properties = feature?.properties ?? {};
  const exitId = String(properties.OBJECTID ?? "").trim();
  const officialName = String(properties.STATION_NA ?? "").trim();
  if (!exitId || !officialName) {
    skipped.invalidIdentity++;
    continue;
  }
  if (seenExitIds.has(exitId)) {
    throw new Error(`Duplicate station exit OBJECTID: ${exitId}`);
  }
  seenExitIds.add(exitId);

  const coordinates = feature?.geometry?.coordinates;
  const lng = Array.isArray(coordinates) ? Number(coordinates[0]) : NaN;
  const lat = Array.isArray(coordinates) ? Number(coordinates[1]) : NaN;
  if (
    feature?.geometry?.type !== "Point" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 1.0 ||
    lat > 1.6 ||
    lng < 103.4 ||
    lng > 104.2
  ) {
    skipped.invalidGeometry++;
    continue;
  }

  const group = groups.get(officialName) ?? {
    officialName,
    exits: [],
    sourceUpdates: [],
  };
  group.exits.push({ lat, lng });
  const updatedAt = sourceUpdatedAt(properties.FMEL_UPD_D);
  if (updatedAt) group.sourceUpdates.push(updatedAt);
  groups.set(officialName, group);
}

const officialNamesByBase = new Map();
for (const officialName of groups.keys()) {
  const normalized = normalizedName(officialName);
  const names = officialNamesByBase.get(normalized) ?? [];
  names.push(officialName);
  officialNamesByBase.set(normalized, names);
}

let curatedMatches = 0;
const items = [...groups.values()]
  .filter((group) => {
    if (modeFor(group.officialName) !== "unknown") return true;
    skipped.skippedCodeOnly++;
    return false;
  })
  .map((group) => {
    const normalized = normalizedName(group.officialName);
    const isUnambiguous = officialNamesByBase.get(normalized)?.length === 1;
    const seed = isUnambiguous ? seedByName.get(normalized) : undefined;
    if (seed) curatedMatches++;
    const lat =
      group.exits.reduce((sum, exit) => sum + exit.lat, 0) /
      group.exits.length;
    const lng =
      group.exits.reduce((sum, exit) => sum + exit.lng, 0) /
      group.exits.length;
    const latestSourceUpdate = group.sourceUpdates.sort().at(-1);
    return {
      id: stationId(group.officialName),
      name: seed?.name ?? displayName(group.officialName),
      officialName: group.officialName,
      mode: modeFor(group.officialName),
      ...(seed ? { code: seed.code, line: seed.line } : {}),
      lat,
      lng,
      geometryAccuracy: "approximate",
      geometryRole: "centroid",
      exitCount: group.exits.length,
      ...(latestSourceUpdate
        ? { sourceUpdatedAt: latestSourceUpdate }
        : {}),
    };
  })
  .sort((left, right) => left.officialName.localeCompare(right.officialName));

if (items.length === 0) throw new Error("No usable train stations were found");
if (new Set(items.map((item) => item.id)).size !== items.length) {
  throw new Error("Normalized station IDs are not unique");
}

const coverage = {
  stationExits: seenExitIds.size,
  stations: items.length,
  mrt: items.filter((item) => item.mode === "mrt").length,
  lrt: items.filter((item) => item.mode === "lrt").length,
  skippedCodeOnly: skipped.skippedCodeOnly,
  curatedCodeMatches: curatedMatches,
};
const output = {
  schemaVersion: 1,
  category: "train_station",
  dataset: {
    id: DATASET_ID,
    publisher: "Land Transport Authority",
    sourceUrl: DATASET_URL,
    licenseUrl: "https://data.gov.sg/open-data-licence",
    retrievedAt,
  },
  coverage,
  items,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: OUTPUT_PATH, retrievedAt, coverage, skipped }));
