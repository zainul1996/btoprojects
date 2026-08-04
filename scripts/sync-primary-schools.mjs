import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { toAmenityDisplayName } from "./amenity-text.mjs";

const MOE_DATASET_ID = "d_688b934f82c1059ed0a6993d2a829089";
const MOE_DATASET_URL = `https://data.gov.sg/datasets/${MOE_DATASET_ID}/view`;
const MOE_API_BASE = `https://api-open.data.gov.sg/v1/public/api/datasets/${MOE_DATASET_ID}`;
const ONEMAP_AUTH_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const ONEMAP_SOURCE_URL = "https://www.onemap.gov.sg/apidocs/search";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(
  SCRIPT_DIR,
  "../public/data/amenities/primary-schools.json",
);
const REQUEST_GAP_MS = 275;
const MAX_CAMPUS_SPREAD_METRES = 350;
const MINIMUM_COVERAGE_RATIO = 0.95;

process.loadEnvFile(join(SCRIPT_DIR, "../.env.local"));

function requiredRetrievalTime(argv) {
  const index = argv.indexOf("--retrieved-at");
  const raw = index >= 0 ? argv[index + 1] : undefined;
  if (!raw) {
    throw new Error(
      "Usage: node scripts/sync-primary-schools.mjs --retrieved-at <ISO timestamp>",
    );
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("--retrieved-at must be a valid ISO timestamp");
  }
  return parsed.toISOString();
}

function sleep(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
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
  const initiated = await fetchJson(`${MOE_API_BASE}/initiate-download`);
  if (initiated.code !== 0) {
    throw new Error(initiated.errorMsg || "Unable to initiate dataset download");
  }
  if (initiated.data?.url) return initiated.data.url;

  for (let attempt = 0; attempt < 10; attempt++) {
    const polled = await fetchJson(`${MOE_API_BASE}/poll-download`);
    if (polled.code === 0 && polled.data?.url) return polled.data.url;
    await sleep(500);
  }
  throw new Error("Dataset download did not become ready after 10 polls");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function recordsFromCsv(text) {
  const [headers, ...rows] = parseCsv(text);
  if (!headers?.includes("school_name") || !headers.includes("postal_code")) {
    throw new Error("MOE school download has an unsupported CSV header");
  }
  return rows
    .filter((row) => row.some(Boolean))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
    );
}

function isPrimaryLevel(row) {
  return row.mainlevel_code === "PRIMARY" ||
    row.mainlevel_code === "MIXED LEVEL (P1-S4)";
}

function normalizedPostalCode(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 5 && digits.length <= 6
    ? digits.padStart(6, "0")
    : "";
}

async function getOneMapToken() {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) {
    throw new Error("ONEMAP_EMAIL/ONEMAP_PASSWORD not set in .env.local");
  }
  const response = await fetch(ONEMAP_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new Error(`OneMap authentication failed with HTTP ${response.status}`);
  }
  return data.access_token;
}

async function searchOneMap(query, token) {
  const params = new URLSearchParams({
    searchVal: query,
    returnGeom: "Y",
    getAddrDetails: "Y",
    pageNum: "1",
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${ONEMAP_SEARCH_URL}?${params}`, {
      headers: { Authorization: token },
    });
    const data = await response.json().catch(() => null);
    if (response.status === 429) {
      await sleep(1_500 * (attempt + 1));
      continue;
    }
    if (
      response.status === 401 ||
      (typeof data?.error === "string" && /token|auth/i.test(data.error))
    ) {
      throw new Error("OneMap Search authentication was rejected");
    }
    if (!response.ok || data?.error) {
      throw new Error(`OneMap Search failed with HTTP ${response.status}`);
    }
    return Array.isArray(data?.results) ? data.results : [];
  }
  throw new Error("OneMap Search rate limit persisted after three retries");
}

function validHit(result) {
  const lat = Number(result?.LATITUDE);
  const lng = Number(result?.LONGITUDE);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= 1.0 && lat <= 1.6 && lng >= 103.4 && lng <= 104.2;
}

function normalized(value) {
  return String(value ?? "")
    .toLocaleLowerCase("en-SG")
    .replace(/\bsingapore\s+\d{6}\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueCoordinateHits(results) {
  const byCoordinate = new Map();
  for (const result of results.filter(validHit)) {
    const key = `${Number(result.LATITUDE).toFixed(7)},${Number(result.LONGITUDE).toFixed(7)}`;
    if (!byCoordinate.has(key)) byCoordinate.set(key, result);
  }
  return [...byCoordinate.values()];
}

function centroidOfHits(hits) {
  return {
    lat: hits.reduce((sum, hit) => sum + Number(hit.LATITUDE), 0) / hits.length,
    lng: hits.reduce((sum, hit) => sum + Number(hit.LONGITUDE), 0) / hits.length,
  };
}

function distanceMetres(left, right) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const earthRadius = 6_371_000;
  const lat1 = toRadians(Number(left.LATITUDE));
  const lat2 = toRadians(Number(right.LATITUDE));
  const latDelta = lat2 - lat1;
  const lngDelta = toRadians(Number(right.LONGITUDE) - Number(left.LONGITUDE));
  const a = Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function campusCentroid(hits) {
  for (let left = 0; left < hits.length; left++) {
    for (let right = left + 1; right < hits.length; right++) {
      if (distanceMetres(hits[left], hits[right]) > MAX_CAMPUS_SPREAD_METRES) {
        return null;
      }
    }
  }
  return centroidOfHits(hits);
}

function tiedToMoeRecord(result, row) {
  if (String(result.POSTAL ?? "").trim() === row.postal_code.trim()) return true;
  const schoolName = normalized(row.school_name);
  const buildingText = normalized(
    `${result.BUILDING ?? ""} ${result.SEARCHVAL ?? ""}`,
  );
  if (schoolName.length >= 8 && buildingText.includes(schoolName)) return true;
  const moeAddress = normalized(row.address);
  const matchedAddress = normalized(result.ADDRESS);
  return moeAddress.length >= 10 && matchedAddress.includes(moeAddress);
}

async function geocodeSchool(row, token) {
  const postalCode = normalizedPostalCode(row.postal_code);
  const postalResults = await searchOneMap(postalCode, token);
  const postalHits = uniqueCoordinateHits(
    postalResults.filter(
      (result) => normalizedPostalCode(result.POSTAL) === postalCode,
    ),
  );
  if (postalHits.length >= 1) {
    const hit = postalHits[0];
    const centroid = campusCentroid(postalHits);
    if (!centroid) return { status: "ambiguous" };
    return {
      status: "matched",
      lat: centroid.lat,
      lng: centroid.lng,
      matchMethod: "postal_exact",
      matchedPointCount: postalHits.length,
      matchedAddress: String(hit.ADDRESS ?? "").trim() || undefined,
    };
  }

  await sleep(REQUEST_GAP_MS);
  const addressResults = await searchOneMap(
    `${row.school_name} ${row.address}`,
    token,
  );
  const tiedHits = uniqueCoordinateHits(
    addressResults.filter((result) => tiedToMoeRecord(result, row)),
  );
  if (tiedHits.length === 0) return { status: "not_found" };
  const hit = tiedHits[0];
  const centroid = campusCentroid(tiedHits);
  if (!centroid) return { status: "ambiguous" };
  return {
    status: "matched",
    lat: centroid.lat,
    lng: centroid.lng,
    matchMethod: "address_search",
    matchedPointCount: tiedHits.length,
    matchedAddress: String(hit.ADDRESS ?? "").trim() || undefined,
  };
}

const retrievedAt = requiredRetrievalTime(process.argv.slice(2));
const csvResponse = await fetch(await downloadUrl(), {
  headers: { "user-agent": "BTOProjects.sg amenity-sync/1.0" },
});
if (!csvResponse.ok) {
  throw new Error(`MOE school download failed with HTTP ${csvResponse.status}`);
}
const rows = recordsFromCsv(await csvResponse.text());
const eligibleRows = rows.filter(isPrimaryLevel);
const token = await getOneMapToken();
const skipped = {
  invalidIdentity: 0,
  invalidAddress: 0,
  noGeocode: 0,
  ambiguousGeocode: 0,
};
const items = [];
for (const row of eligibleRows) {
  const officialName = row.school_name.trim();
  const postalCode = normalizedPostalCode(row.postal_code);
  if (!officialName || !postalCode) {
    skipped.invalidIdentity++;
    continue;
  }
  const address = row.address.trim().replace(/\s+/g, " ");
  if (!address) {
    skipped.invalidAddress++;
    continue;
  }
  const geocode = await geocodeSchool({ ...row, postal_code: postalCode }, token);
  if (geocode.status === "ambiguous") {
    skipped.ambiguousGeocode++;
    continue;
  }
  if (geocode.status !== "matched") {
    skipped.noGeocode++;
    continue;
  }
  items.push({
    id: postalCode,
    name: toAmenityDisplayName(officialName),
    officialName,
    address,
    postalCode,
    schoolLevel: row.mainlevel_code === "PRIMARY" ? "primary" : "mixed_primary_secondary",
    lat: geocode.lat,
    lng: geocode.lng,
    geometryAccuracy: "approximate",
    geometryRole: "site",
    matchMethod: geocode.matchMethod,
    matchedPointCount: geocode.matchedPointCount,
    ...(geocode.matchedAddress ? { matchedAddress: geocode.matchedAddress } : {}),
  });
  await sleep(REQUEST_GAP_MS);
}

items.sort((left, right) => left.id.localeCompare(right.id, "en", { numeric: true }));
if (items.length === 0) throw new Error("No primary schools were geocoded");
if (items.length / eligibleRows.length < MINIMUM_COVERAGE_RATIO) {
  throw new Error(
    `Primary-school geocode coverage ${items.length}/${eligibleRows.length} is below the required 95%`,
  );
}
if (new Set(items.map((item) => item.id)).size !== items.length) {
  throw new Error("MOE primary school postal codes are not unique");
}

const output = {
  schemaVersion: 1,
  category: "primary_school",
  dataset: {
    id: MOE_DATASET_ID,
    name: "School Directory and Information",
    publisher: "Ministry of Education",
    sourceUrl: MOE_DATASET_URL,
    licenseUrl: "https://data.gov.sg/open-data-licence",
    retrievedAt,
  },
  geocoder: {
    name: "OneMap Search",
    publisher: "Singapore Land Authority",
    sourceUrl: ONEMAP_SOURCE_URL,
    retrievedAt,
  },
  coverage: {
    sourceRows: rows.length,
    eligiblePrimaryRows: eligibleRows.length,
    schools: items.length,
    skipped: skipped.invalidIdentity + skipped.invalidAddress +
      skipped.noGeocode + skipped.ambiguousGeocode,
    ...skipped,
  },
  items,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({ output: OUTPUT_PATH, retrievedAt, coverage: output.coverage }),
);
