import type { PlannerConstraints } from "@/components/planner/ranking-card";

export function constraintsFromProfile(profile: {
  budgetMax?: number;
  waitToleranceMonths?: number;
  flatTypes: string[];
  towns?: string[];
  regions?: string[];
  workplaceCount: number;
  hasParentsArea: boolean;
}): PlannerConstraints {
  const seeded: NonNullable<PlannerConstraints> = {
    ...(profile.budgetMax !== undefined
      ? { budgetMax: profile.budgetMax }
      : {}),
    ...(profile.waitToleranceMonths !== undefined
      ? { waitToleranceMonths: profile.waitToleranceMonths }
      : {}),
    ...(profile.flatTypes.length > 0 ? { flatTypes: profile.flatTypes } : {}),
    ...(profile.towns?.length ? { towns: profile.towns } : {}),
    ...(profile.regions?.length ? { regions: profile.regions } : {}),
    ...(profile.workplaceCount > 0
      ? {
          workplaces: Array.from(
            { length: Math.min(profile.workplaceCount, 2) },
            (_, index) => `Workplace ${index + 1}`,
          ),
        }
      : {}),
    ...(profile.hasParentsArea ? { parentsArea: "Parents’ area" } : {}),
  };
  return Object.keys(seeded).length > 0 ? seeded : null;
}
