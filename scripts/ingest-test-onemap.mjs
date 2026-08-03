#!/usr/bin/env node
/**
 * Standalone OneMap geocoding smoke test — no Convex writes.
 *
 * Verifies, against the live API:
 *   1. Whether the env ONEMAP_TOKEN (a 72h JWT) is accepted or rejected.
 *   2. Whether email/password re-auth via /api/auth/post/getToken works.
 *   3. What the elastic search endpoint returns for two sample queries.
 *
 * Usage: node scripts/ingest-test-onemap.mjs
 * Secrets are loaded from .env.local and never printed.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(join(root, ".env.local"));

const TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const QUERIES = ["Woodgrove Acres BTO", "Sembawang"];
const REQUEST_GAP_MS = 150;

/** Decode a JWT payload's exp without printing the token itself. */
function jwtExpiry(token) {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.exp === "number" ? new Date(json.exp * 1000) : null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function search(query, token) {
  const params = new URLSearchParams({
    searchVal: query,
    returnGeom: "Y",
    getAddrDetails: "Y",
    pageNum: "1",
  });
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: token },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function isAuthError(status, data) {
  if (status === 401) return true;
  return typeof data?.error === "string" && /token|auth/i.test(data.error);
}

async function reauthenticate() {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) {
    throw new Error("ONEMAP_EMAIL/ONEMAP_PASSWORD not set in .env.local");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(
      `getToken failed: HTTP ${res.status} ${JSON.stringify(data)?.slice(0, 200)}`,
    );
  }
  return data;
}

const envToken = process.env.ONEMAP_TOKEN;
if (!envToken) {
  console.error("ONEMAP_TOKEN not set in .env.local");
  process.exit(1);
}

const envExpiry = jwtExpiry(envToken);
console.log(
  `env ONEMAP_TOKEN JWT exp: ${
    envExpiry
      ? `${envExpiry.toISOString()} (${envExpiry.getTime() < Date.now() ? "EXPIRED" : "valid"})`
      : "unparseable (not a JWT?)"
  }`,
);

let token = envToken;
let authMode = "env token";
let reauthInfo = null;
let lastRequestAt = 0;

for (const query of QUERIES) {
  const wait = REQUEST_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  let { status, data } = await search(query, token);
  lastRequestAt = Date.now();

  if (isAuthError(status, data) && authMode === "env token") {
    console.log("env token rejected → re-authenticating with email/password…");
    const fresh = await reauthenticate();
    token = fresh.access_token;
    authMode = "email/password re-auth";
    reauthInfo = {
      expiry: new Date(Number(fresh.expiry_timestamp) * 1000).toISOString(),
    };
    await sleep(REQUEST_GAP_MS);
    ({ status, data } = await search(query, token));
    lastRequestAt = Date.now();
  }

  console.log(`\nQuery: ${JSON.stringify(query)}`);
  console.log(`  HTTP status: ${status} (auth: ${authMode})`);
  if (data?.error) {
    console.log(`  API error field: ${data.error}`);
  }
  const found = data?.found ?? 0;
  console.log(`  found: ${found}`);
  const top = data?.results?.[0];
  if (found > 0 && top) {
    console.log(`  top result:`);
    console.log(`    LATITUDE:  ${top.LATITUDE ?? "?"}`);
    console.log(`    LONGITUDE: ${top.LONGITUDE ?? "?"}`);
    console.log(`    ADDRESS:   ${top.ADDRESS ?? "?"}`);
  } else {
    console.log("  no results");
  }
}

console.log(
  `\nSummary: ${authMode === "env token" ? "env token worked; no re-auth needed" : `env token failed; re-auth succeeded (new token expiry ${reauthInfo.expiry})`}`,
);
