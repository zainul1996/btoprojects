import { haversineKm } from "./geo";

/**
 * Deterministic, LLM-free project ranking.
 *
 * Given the governed project records and a set of user constraints, produce a
 * transparent 0-100 score with a per-component breakdown and human-readable
 * reasons. The planner narrates these results; it never invents its own
 * ordering (guardrail: the AI is an interface over governed data).
 */

export interface RankableFlatType {
  type: string;
  units: number;
  minPrice: number;
  maxPrice: number;
}

export interface RankableProject {
  slug: string;
  name: string;
  town: string;
  region: string;
  classification: "Standard" | "Plus" | "Prime";
  lifecycleStatus: string;
  estimatedWaitMonths: number;
  estimatedCompletion: string;
  applicationDeadline?: string;
  exerciseLabel?: string;
  lat: number;
  lng: number;
  mrtWalkingMinutes: number;
  flatTypes: RankableFlatType[];
}

export interface GeoPreference {
  label: string;
  lat?: number;
  lng?: number;
}

export interface PlannerConstraints {
  budgetMax?: number;
  flatTypes?: string[];
  waitToleranceMonths?: number;
  towns?: string[];
  regions?: string[];
  workplaces?: GeoPreference[];
  parentsArea?: GeoPreference;
}

export interface ScoreComponent {
  score: number; // 0-100
  reasons: string[];
}

export interface RankedProject {
  project: RankableProject;
  totalScore: number; // 0-100
  breakdown: {
    budgetFit: ScoreComponent;
    waitFit: ScoreComponent;
    flatTypeFit: ScoreComponent;
    locationFit: ScoreComponent;
  };
}

const WEIGHTS = {
  budgetFit: 0.35,
  waitFit: 0.25,
  flatTypeFit: 0.2,
  locationFit: 0.2,
} as const;

function formatSgd(value: number): string {
  return `S$${Math.round(value / 1000)}k`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function relevantFlatTypes(
  project: RankableProject,
  constraints: PlannerConstraints,
): RankableFlatType[] {
  const wanted = constraints.flatTypes;
  if (!wanted?.length) return project.flatTypes;
  const matching = project.flatTypes.filter((f) => wanted.includes(f.type));
  return matching.length > 0 ? matching : project.flatTypes;
}

function scoreBudget(
  project: RankableProject,
  constraints: PlannerConstraints,
): ScoreComponent {
  const budget = constraints.budgetMax;
  if (!budget) {
    return { score: 50, reasons: ["No budget set — scored neutral"] };
  }
  const candidates = relevantFlatTypes(project, constraints);
  if (candidates.length === 0) {
    return { score: 20, reasons: ["No flats listed for this project"] };
  }
  const cheapest = candidates.reduce(
    (min, f) => (f.minPrice < min.minPrice ? f : min),
    candidates[0],
  );
  const label = `${cheapest.type} from ${formatSgd(cheapest.minPrice)}`;
  const ratio = cheapest.minPrice / budget;
  const reasons: string[] = [];

  let score: number;
  if (ratio <= 0.75) {
    score = 100;
    reasons.push(`${label} — comfortably within your ${formatSgd(budget)} budget`);
  } else if (ratio <= 1) {
    score = 75 + ((1 - ratio) / 0.25) * 25;
    reasons.push(`${label} within your ${formatSgd(budget)} budget`);
  } else if (ratio <= 1.25) {
    score = 75 - ((ratio - 1) / 0.25) * 45;
    reasons.push(
      `${label} is above your ${formatSgd(budget)} budget (${Math.round(
        (ratio - 1) * 100,
      )}% over)`,
    );
  } else {
    score = 10;
    reasons.push(
      `${label} is ${Math.round((ratio - 1) * 100)}% above your ${formatSgd(
        budget,
      )} budget`,
    );
  }

  const covered = candidates.filter((f) => f.maxPrice <= budget);
  if (covered.length > 0) {
    reasons.push(
      `Budget fully covers the ${covered
        .map((f) => f.type)
        .join(", ")} range${covered.length > 1 ? "s" : ""}`,
    );
  }
  return { score: Math.round(clamp(score, 0, 100)), reasons };
}

function scoreWait(
  project: RankableProject,
  constraints: PlannerConstraints,
): ScoreComponent {
  const tolerance = constraints.waitToleranceMonths;
  const wait = project.estimatedWaitMonths;
  if (!tolerance) {
    return {
      score: 50,
      reasons: [`${wait}-month estimated wait — no tolerance set, scored neutral`],
    };
  }
  const diff = tolerance - wait;
  if (diff >= 12) {
    return {
      score: 100,
      reasons: [`${wait}-month wait is well within your ${tolerance}-month tolerance`],
    };
  }
  if (diff >= 0) {
    return {
      score: 80,
      reasons: [`${wait}-month wait within your ${tolerance}-month tolerance`],
    };
  }
  if (diff >= -6) {
    return {
      score: 45,
      reasons: [`${wait}-month wait slightly exceeds your ${tolerance}-month tolerance`],
    };
  }
  return {
    score: 15,
    reasons: [`${wait}-month wait exceeds your ${tolerance}-month tolerance`],
  };
}

function scoreFlatTypes(
  project: RankableProject,
  constraints: PlannerConstraints,
): ScoreComponent {
  const wanted = constraints.flatTypes;
  if (!wanted?.length) {
    return { score: 60, reasons: ["No flat-type preference set — scored neutral"] };
  }
  const offered = project.flatTypes.map((f) => f.type);
  const hits = wanted.filter((t) => offered.includes(t));
  const misses = wanted.filter((t) => !offered.includes(t));

  if (hits.length === 0) {
    return {
      score: 5,
      reasons: [
        `Does not offer any of your preferred flat types (${wanted.join(", ")})`,
      ],
    };
  }
  const score = Math.round((hits.length / wanted.length) * 100);
  const reasons = [
    misses.length === 0
      ? `Offers all your preferred flat types (${hits.join(", ")})`
      : `Offers ${hits.join(", ")} but not ${misses.join(", ")}`,
  ];
  return { score, reasons };
}

function scoreLocation(
  project: RankableProject,
  constraints: PlannerConstraints,
): ScoreComponent {
  const { towns, regions, workplaces, parentsArea } = constraints;
  const reasons: string[] = [];
  let score: number | null = null;

  if (towns?.length) {
    if (towns.some((t) => t.toLowerCase() === project.town.toLowerCase())) {
      score = 100;
      reasons.push(`In ${project.town}, one of your preferred towns`);
    } else {
      score = 30;
      reasons.push(
        `${project.town} is outside your preferred towns (${towns.join(", ")})`,
      );
    }
  }

  if (regions?.length) {
    if (regions.some((r) => r.toLowerCase() === project.region.toLowerCase())) {
      score = Math.max(score ?? 0, 80);
      reasons.push(`In the ${project.region} region you prefer`);
    } else if (score === null) {
      score = 35;
      reasons.push(
        `${project.region} region is outside your preferred regions (${regions.join(", ")})`,
      );
    }
  }

  const workplacesWithCoords = (workplaces ?? []).filter(
    (w): w is { label: string; lat: number; lng: number } =>
      w.lat !== undefined && w.lng !== undefined,
  );
  if (workplacesWithCoords.length > 0) {
    const nearest = workplacesWithCoords.reduce((best, w) => {
      const d = haversineKm(project.lat, project.lng, w.lat, w.lng);
      return !best || d < best.distanceKm ? { workplace: w, distanceKm: d } : best;
    }, null as { workplace: { label: string; lat: number; lng: number }; distanceKm: number } | null);
    if (nearest) {
      const commuteScore = clamp(100 - (nearest.distanceKm - 2) * 6, 20, 100);
      const roundedKm = Math.round(nearest.distanceKm * 10) / 10;
      reasons.push(
        `≈${roundedKm}km straight-line to ${nearest.workplace.label} (commute estimate pending routing)`,
      );
      score = Math.max(score ?? 0, Math.round(commuteScore));
    }
  }

  if (parentsArea?.lat !== undefined && parentsArea.lng !== undefined) {
    const d = haversineKm(project.lat, project.lng, parentsArea.lat, parentsArea.lng);
    if (d <= 4) {
      reasons.push(
        `Within ~${Math.round(d * 10) / 10}km of parents' area (${parentsArea.label})`,
      );
      score = Math.min(100, (score ?? 50) + 10);
    }
  }

  if (score === null) {
    return { score: 50, reasons: ["No location preference set — scored neutral"] };
  }
  return { score: clamp(score, 0, 100), reasons };
}

export function rankProjects(
  projects: RankableProject[],
  constraints: PlannerConstraints,
): RankedProject[] {
  const ranked = projects.map((project) => {
    const breakdown = {
      budgetFit: scoreBudget(project, constraints),
      waitFit: scoreWait(project, constraints),
      flatTypeFit: scoreFlatTypes(project, constraints),
      locationFit: scoreLocation(project, constraints),
    };
    const totalScore = Math.round(
      breakdown.budgetFit.score * WEIGHTS.budgetFit +
        breakdown.waitFit.score * WEIGHTS.waitFit +
        breakdown.flatTypeFit.score * WEIGHTS.flatTypeFit +
        breakdown.locationFit.score * WEIGHTS.locationFit,
    );
    return { project, totalScore, breakdown };
  });
  return ranked.sort(
    (a, b) =>
      b.totalScore - a.totalScore || a.project.name.localeCompare(b.project.name),
  );
}
