import type { RankingResultItem } from "../../../convex/lib/plannerShared";
import type { PlannerSuggestion, PlannerUIMessage } from "@/lib/planner/types";

export function textOf(message: PlannerUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function rankingsDataOf(message: PlannerUIMessage) {
  const part = message.parts.find((p) => p.type === "data-rankings");
  return part && part.type === "data-rankings" ? part.data : null;
}

export function rankingsOf(message: PlannerUIMessage): RankingResultItem[] | null {
  return rankingsDataOf(message)?.rankings ?? null;
}

export function suggestionsOf(message: PlannerUIMessage): PlannerSuggestion[] {
  const part = message.parts.find((p) => p.type === "data-suggestions");
  return part && part.type === "data-suggestions" ? part.data.suggestions : [];
}

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

// Locale-stable ISO formatting: new Date("2026-08-02") shifts a day in
// negative-offset timezones, so render straight from the string parts.
export function formatDataAsOf(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  const month = MONTHS_SHORT[monthIndex];
  if (month === undefined) return null;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

export function citedMapOf(
  rankings: RankingResultItem[] | null,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of rankings ?? []) map.set(item.slug, item.name);
  return map;
}

export function citedSlugsIn(
  text: string,
  rankings: RankingResultItem[] | null,
) {
  const known = new Set((rankings ?? []).map((r) => r.slug));
  const found = new Set<string>();
  for (const match of text.matchAll(/\[([a-z0-9][a-z0-9-]*)\]/g)) {
    if (known.has(match[1])) found.add(match[1]);
  }
  return [...found];
}
