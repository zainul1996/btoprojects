import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { toAmenityDisplayName } from "./amenity-text.mjs";

const DATASET_ID = "d_77d7ec97be83d44f61b85454f844382f";
const DATASET_URL = `https://data.gov.sg/datasets/${DATASET_ID}/view`;
const API_BASE = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}`;
const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/data/amenities/parks.json",
);

function requiredRetrievalTime(argv) {
  const index = argv.indexOf("--retrieved-at");
  const raw = index >= 0 ? argv[index + 1] : undefined;
  if (!raw) {
    throw new Error(
      "Usage: node scripts/sync-parks.mjs --retrieved-at <ISO timestamp>",
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

function sourceUpdatedAt(raw) {
  if (typeof raw !== "string" || !/^\d{14}$/.test(raw)) return undefined;
  const value = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` +
    `T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}+08:00`;
  return Number.isFinite(new Date(value).getTime()) ? value : undefined;
}

function ringCentroid(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let twiceArea = 0;
  let ringLng = 0;
  let ringLat = 0;
  for (let index = 0; index < ring.length; index++) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (!Array.isArray(current) || !Array.isArray(next)) continue;
    const cross = Number(current[0]) * Number(next[1]) -
      Number(next[0]) * Number(current[1]);
    if (!Number.isFinite(cross)) continue;
    twiceArea += cross;
    ringLng += (Number(current[0]) + Number(next[0])) * cross;
    ringLat += (Number(current[1]) + Number(next[1])) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) return null;
  return {
    lng: ringLng / (3 * twiceArea),
    lat: ringLat / (3 * twiceArea),
    area: Math.abs(twiceArea / 2),
  };
}

function polygonCentroid(rings) {
  let weightedLng = 0;
  let weightedLat = 0;
  let totalArea = 0;
  for (let index = 0; index < rings.length; index++) {
    const centroid = ringCentroid(rings[index]);
    if (!centroid) continue;
    const signedArea = index === 0 ? centroid.area : -centroid.area;
    weightedLng += centroid.lng * signedArea;
    weightedLat += centroid.lat * signedArea;
    totalArea += signedArea;
  }
  if (Math.abs(totalArea) < 1e-12) return null;
  return {
    lng: weightedLng / totalArea,
    lat: weightedLat / totalArea,
    area: totalArea,
  };
}

function geometryCentroid(geometry) {
  if (geometry?.type === "Polygon") {
    return polygonCentroid(geometry.coordinates);
  }
  if (geometry?.type !== "MultiPolygon" || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const centroids = [];
  for (const polygon of geometry.coordinates) {
    const centroid = polygonCentroid(polygon);
    if (centroid) centroids.push(centroid);
  }
  if (centroids.length === 0) return null;
  const totalArea = centroids.reduce((sum, point) => sum + point.area, 0);
  if (totalArea <= 0) return null;
  return {
    lng: centroids.reduce((sum, point) => sum + point.lng * point.area, 0) /
      totalArea,
    lat: centroids.reduce((sum, point) => sum + point.lat * point.area, 0) /
      totalArea,
    area: totalArea,
  };
}

function transformFeature(feature, skipped) {
  const properties = feature?.properties ?? {};
  const id = String(properties.OBJECTID_1 ?? "").trim();
  const officialName = String(properties.NAME ?? "").trim();
  if (!id || !officialName) {
    skipped.invalidIdentity++;
    return null;
  }

  const centroid = geometryCentroid(feature?.geometry);
  if (
    !centroid ||
    !Number.isFinite(centroid.lat) ||
    !Number.isFinite(centroid.lng) ||
    centroid.lat < 1.0 ||
    centroid.lat > 1.6 ||
    centroid.lng < 103.4 ||
    centroid.lng > 104.2
  ) {
    skipped.invalidGeometry++;
    return null;
  }

  const updatedAt = sourceUpdatedAt(properties.FMEL_UPD_D);
  return {
    id,
    name: toAmenityDisplayName(officialName),
    officialName,
    lat: centroid.lat,
    lng: centroid.lng,
    geometryAccuracy: "approximate",
    geometryRole: "centroid",
    sourceGeometryType: feature.geometry.type,
    ...(updatedAt ? { sourceUpdatedAt: updatedAt } : {}),
  };
}

const retrievedAt = requiredRetrievalTime(process.argv.slice(2));
const geojson = await fetchJson(await downloadUrl());
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  throw new Error("NParks download is not a GeoJSON FeatureCollection");
}

const skipped = { invalidIdentity: 0, invalidGeometry: 0 };
const items = geojson.features
  .map((feature) => transformFeature(feature, skipped))
  .filter((item) => item !== null)
  .sort((left, right) =>
    left.id.localeCompare(right.id, "en", { numeric: true }),
  );
if (items.length === 0) throw new Error("No usable park records were found");
if (new Set(items.map((item) => item.id)).size !== items.length) {
  throw new Error("The park dataset contains duplicate OBJECTID values");
}
const sourceLastUpdatedAt = items
  .map((item) => item.sourceUpdatedAt)
  .filter((value) => typeof value === "string")
  .sort()
  .at(-1);
if (!sourceLastUpdatedAt) {
  throw new Error("NParks records do not contain a usable source update time");
}

const output = {
  schemaVersion: 1,
  category: "park",
  dataset: {
    id: DATASET_ID,
    name: "NParks Parks and Nature Reserves",
    publisher: "National Parks Board",
    sourceUrl: DATASET_URL,
    licenseUrl: "https://data.gov.sg/open-data-licence",
    retrievedAt,
    sourceLastUpdatedAt,
  },
  coverage: {
    sourceFeatures: geojson.features.length,
    parks: items.length,
    skipped: skipped.invalidIdentity + skipped.invalidGeometry,
    ...skipped,
  },
  items,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({ output: OUTPUT_PATH, retrievedAt, coverage: output.coverage }),
);
