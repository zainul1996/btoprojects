import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import type { SourceBadgeVariant } from "@/components/source-badge";

export type ProjectDetails = NonNullable<
  FunctionReturnType<typeof api.projects.getBySlug>
>;
export type FactMap = ProjectDetails["facts"];
export type Comparables = FunctionReturnType<typeof api.projects.comparables>;

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2029-08" → "Aug 2029". Falls back to the raw string on malformed input. */
export function formatMonthYear(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "2026-02-11" → "11 Feb 2026". */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** Epoch ms → "2 Aug 2026". */
export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** "Kallang/Whampoa" → "/bto/town/kallang-whampoa". */
export function townHref(townName: string): string {
  const slug = townName
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/\s+/g, "-");
  return `/bto/town/${slug}`;
}

/**
 * Inverse of townHref's slug: "bukit-merah" → "Bukit Merah".
 * Only "Kallang/Whampoa" breaks plain capitalisation.
 */
export function decodeTownParam(param: string): string {
  const SPECIAL: Record<string, string> = {
    "kallang-whampoa": "Kallang/Whampoa",
  };
  const key = param.toLowerCase();
  if (SPECIAL[key]) return SPECIAL[key];
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Provenance lookup: the confidence carried by a fact field, with a policy
 * fallback when the field was never recorded (exercise-published fields are
 * official; coordinates, walk times and completion are our estimates).
 */
export function factConfidence(
  facts: FactMap,
  field: string,
  fallback: SourceBadgeVariant,
): SourceBadgeVariant {
  const rows = facts[field];
  if (rows && rows.length > 0) return rows[0].confidence;
  return fallback;
}

/** Newest retrieval timestamp across facts and sources — the "verified" date. */
export function latestRetrievedAt(details: ProjectDetails): number {
  let max = 0;
  for (const rows of Object.values(details.facts)) {
    for (const fact of rows) {
      if (fact.retrievedAt > max) max = fact.retrievedAt;
    }
  }
  for (const source of details.sources) {
    if (source.retrievedAt > max) max = source.retrievedAt;
  }
  return max || details.project.updatedAt;
}

/** Lowest flat-type entry price for a project, or null when unpriced. */
export function fromPrice(
  flatTypes: { minPrice: number }[],
): number | null {
  if (flatTypes.length === 0) return null;
  return Math.min(...flatTypes.map((f) => f.minPrice));
}

/** Monthly instalment for a fixed-rate amortising loan. */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  years: number,
): number {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

/** Deterministic thousands grouping — "1,052". Matches price.tsx. */
export function formatCount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Human label for an exercise status — one wording across all pages. */
export function exerciseStatusLabel(
  status: "upcoming" | "open" | "closed",
): string {
  if (status === "open") return "Open for application";
  if (status === "upcoming") return "Upcoming";
  return "Closed";
}
