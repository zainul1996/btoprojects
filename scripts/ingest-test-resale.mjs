#!/usr/bin/env node
/**
 * Standalone network + parse test for the data.gov.sg resale pipeline
 * (convex/ingest/resale.ts). Performs exactly one poll-download and one CSV
 * download, then prints row/month stats and sample rows.
 *
 * Writes NOTHING to Convex. The API key is only sent as a request header and
 * is never printed.
 *
 * Usage: node scripts/ingest-test-resale.mjs
 */

process.loadEnvFile(".env.local");

const DATASET_ID = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
const POLL_DOWNLOAD_URL = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}/poll-download`;

/** "ANG MO KIO" -> "Ang Mo Kio"; "KALLANG/WHAMPOA" -> "Kallang/Whampoa". */
function titleCase(value) {
  return value
    .trim()
    .toLowerCase()
    .split(/([/\s]+)/)
    .map((part) =>
      part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join("");
}

/** "3 ROOM" -> "3-room"; "MULTI-GENERATION" -> "multi-generation". */
function normalizeFlatType(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Minimal RFC-4180-style CSV parser: handles quoted fields, escaped quotes
 * (""), commas/newlines inside quotes, CRLF, and a leading BOM.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) {
    i = 1;
  }
  for (; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseResaleCsv(csvText) {
  const table = parseCsv(csvText);
  if (table.length < 2) {
    return { rows: [], skipped: 0 };
  }
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const idx = {
    month: col("month"),
    town: col("town"),
    flatType: col("flat_type"),
    block: col("block"),
    streetName: col("street_name"),
    storeyRange: col("storey_range"),
    floorAreaSqm: col("floor_area_sqm"),
    flatModel: col("flat_model"),
    leaseCommenceDate: col("lease_commence_date"),
    resalePrice: col("resale_price"),
  };
  const missing = Object.entries(idx)
    .filter(([, position]) => position === -1)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`CSV missing expected columns: ${missing.join(", ")}`);
  }

  const rows = [];
  let skipped = 0;
  for (const fields of table.slice(1)) {
    if (fields.length < header.length) {
      skipped++;
      continue;
    }
    const month = fields[idx.month].trim();
    const floorAreaSqm = Number(fields[idx.floorAreaSqm]);
    const leaseCommenceDate = Number(fields[idx.leaseCommenceDate]);
    const resalePrice = Number(fields[idx.resalePrice]);
    if (
      !/^\d{4}-\d{2}$/.test(month) ||
      !Number.isFinite(floorAreaSqm) ||
      !Number.isFinite(leaseCommenceDate) ||
      !Number.isFinite(resalePrice)
    ) {
      skipped++;
      continue;
    }
    rows.push({
      month,
      town: titleCase(fields[idx.town]),
      flatType: normalizeFlatType(fields[idx.flatType]),
      block: fields[idx.block].trim(),
      streetName: fields[idx.streetName].trim(),
      storeyRange: fields[idx.storeyRange].trim(),
      floorAreaSqm,
      flatModel: fields[idx.flatModel].trim(),
      leaseCommenceDate,
      resalePrice,
    });
  }
  return { rows, skipped };
}

async function main() {
  const apiKey = process.env.DATAGOV_API_KEY;
  const headers = apiKey ? { "x-api-key": apiKey } : {};
  console.log(
    `API key: ${apiKey ? `present (${apiKey.length} chars, value hidden)` : "MISSING — calling without key (rate-limited)"}`,
  );

  console.log(`\n[1/2] poll-download ${POLL_DOWNLOAD_URL}`);
  const pollRes = await fetch(POLL_DOWNLOAD_URL, { headers });
  if (!pollRes.ok) {
    throw new Error(`poll-download failed: HTTP ${pollRes.status}`);
  }
  const pollBody = await pollRes.json();
  if (pollBody.code !== 0 || typeof pollBody.data?.url !== "string") {
    throw new Error(
      `poll-download unexpected response: code=${pollBody.code} errorMsg=${pollBody.errorMsg}`,
    );
  }
  const downloadUrl = pollBody.data.url;
  console.log(`  status=${pollBody.data.status} (short-lived URL received)`);

  console.log("[2/2] downloading CSV…");
  const csvRes = await fetch(downloadUrl);
  if (!csvRes.ok) {
    throw new Error(`CSV download failed: HTTP ${csvRes.status}`);
  }
  const csvText = await csvRes.text();
  console.log(`  downloaded ${(csvText.length / 1024 / 1024).toFixed(1)} MB`);

  const { rows, skipped } = parseResaleCsv(csvText);
  const months = [...new Set(rows.map((row) => row.month))].sort();

  console.log("\n=== Results ===");
  console.log(`Total parsed rows: ${rows.length}`);
  console.log(`Skipped malformed/short rows: ${skipped}`);
  console.log(`Distinct months: ${months.length}`);
  console.log(`Month range: ${months[0]} .. ${months[months.length - 1]}`);
  console.log(`3 newest months: ${months.slice(-3).join(", ")}`);

  console.log("\n3 sample parsed rows (newest month):");
  const newestMonth = months[months.length - 1];
  for (const row of rows.filter((r) => r.month === newestMonth).slice(0, 3)) {
    console.log(JSON.stringify(row));
  }
}

main().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
