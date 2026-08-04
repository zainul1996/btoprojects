import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATASET_ID = "d_4a086da0a5553be1d89383cd90d07ecd";
const DATASET_URL = `https://data.gov.sg/datasets/${DATASET_ID}/view`;
const API_BASE = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}`;
const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/data/amenities/hawker-centres.json",
);
const CURRENT_SOURCE_STATUSES = new Set([
  "Existing",
  "Existing (new)",
  "Existing (replacement)",
  "Interim Centre",
]);
const PLANNED_SOURCE_STATUSES = new Set(["Under Construction"]);

function requiredRetrievalTime(argv) {
  const index = argv.indexOf("--retrieved-at");
  const raw = index >= 0 ? argv[index + 1] : undefined;
  if (!raw) {
    throw new Error(
      "Usage: node scripts/sync-hawker-centres.mjs --retrieved-at <ISO timestamp>",
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

function mappedStatus(sourceStatus) {
  if (CURRENT_SOURCE_STATUSES.has(sourceStatus)) return "current";
  if (PLANNED_SOURCE_STATUSES.has(sourceStatus)) return "planned";
  return null;
}

function sourceUpdatedAt(raw) {
  if (typeof raw !== "string" || !/^\d{14}$/.test(raw)) return undefined;
  const value = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` +
    `T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}+08:00`;
  return Number.isFinite(new Date(value).getTime()) ? value : undefined;
}

function transformFeature(feature, skipped) {
  const properties = feature?.properties ?? {};
  const id = String(properties.OBJECTID ?? "").trim();
  const name = String(properties.NAME ?? properties.ADDRESSBUILDINGNAME ?? "").trim();
  if (!id || !name) {
    skipped.invalidIdentity++;
    return null;
  }

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
    return null;
  }

  const sourceStatus = String(properties.STATUS ?? "").trim();
  const status = mappedStatus(sourceStatus);
  if (!status) {
    skipped.unknownStatus++;
    return null;
  }

  const address = String(properties.ADDRESS_MYENV ?? "").trim() || undefined;
  const updatedAt = sourceUpdatedAt(properties.FMEL_UPD_D);
  const stalls = Number(properties.NUMBER_OF_COOKED_FOOD_STALLS);

  return {
    id,
    name,
    status,
    sourceStatus,
    ...(address ? { address } : {}),
    lat,
    lng,
    geometryAccuracy: "exact",
    geometryRole: "site",
    ...(updatedAt ? { sourceUpdatedAt: updatedAt } : {}),
    ...(Number.isInteger(stalls) && stalls >= 0
      ? { cookedFoodStalls: stalls }
      : {}),
  };
}

const retrievedAt = requiredRetrievalTime(process.argv.slice(2));
const geojson = await fetchJson(await downloadUrl());
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  throw new Error("Hawker centre download is not a GeoJSON FeatureCollection");
}

const skipped = { invalidIdentity: 0, invalidGeometry: 0, unknownStatus: 0 };
const items = geojson.features
  .map((feature) => transformFeature(feature, skipped))
  .filter((item) => item !== null)
  .sort((left, right) =>
    left.id.localeCompare(right.id, "en", { numeric: true }),
  );
if (items.length === 0) throw new Error("No usable hawker centres were found");
if (new Set(items.map((item) => item.id)).size !== items.length) {
  throw new Error("The hawker dataset contains duplicate OBJECTID values");
}

const output = {
  schemaVersion: 1,
  category: "hawker",
  dataset: {
    id: DATASET_ID,
    publisher: "National Environment Agency",
    sourceUrl: DATASET_URL,
    licenseUrl: "https://data.gov.sg/open-data-licence",
    retrievedAt,
  },
  items,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({
    output: OUTPUT_PATH,
    retrievedAt,
    written: items.length,
    skipped,
  }),
);
