export const PROFILE_FLAT_TYPES = [
  "2-room Flexi",
  "3-room",
  "4-room",
  "5-room",
  "3Gen",
] as const;

export const PROFILE_REGIONS = [
  "Central",
  "East",
  "North",
  "North-East",
  "West",
] as const;

export const PROFILE_LIMITS = {
  budgetMin: 100_000,
  budgetMax: 2_000_000,
  waitMinMonths: 1,
  waitMaxMonths: 120,
  towns: 8,
  workplaces: 2,
  labelMin: 3,
  labelMax: 120,
} as const;

export interface SavedGeoPoint {
  label: string;
  address?: string;
  lat: number;
  lng: number;
}

export interface ProfileGeo {
  workplaces: SavedGeoPoint[];
  parentsArea?: SavedGeoPoint;
}

export interface LabelGeoPreference {
  label: string;
  lat?: number;
  lng?: number;
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = cleanText(raw);
    const key = value.toLocaleLowerCase("en-SG");
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function isSingaporeCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 1.1 &&
    lat <= 1.5 &&
    lng >= 103.5 &&
    lng <= 104.1
  );
}

function assertGeoPoint(point: SavedGeoPoint): SavedGeoPoint {
  const label = cleanText(point.label);
  if (
    label.length < PROFILE_LIMITS.labelMin ||
    label.length > PROFILE_LIMITS.labelMax
  ) {
    throw new Error("Saved place labels must be 3 to 120 characters");
  }
  const address =
    point.address === undefined ? undefined : cleanText(point.address);
  if (
    address !== undefined &&
    (address.length < PROFILE_LIMITS.labelMin ||
      address.length > PROFILE_LIMITS.labelMax)
  ) {
    throw new Error("Saved addresses must be 3 to 120 characters");
  }
  if (!isSingaporeCoordinate(point.lat, point.lng)) {
    throw new Error("Saved place coordinates must be within Singapore");
  }
  return {
    label,
    ...(address ? { address } : {}),
    lat: point.lat,
    lng: point.lng,
  };
}

export function normalizeProfileInput(input: {
  budgetMax?: number;
  waitToleranceMonths?: number;
  flatTypes: string[];
  towns?: string[];
  regions?: string[];
  workplaces: SavedGeoPoint[];
  parentsArea?: SavedGeoPoint;
}): {
  budgetMax?: number;
  waitToleranceMonths?: number;
  flatTypes: string[];
  towns: string[];
  regions: string[];
  workplaces: SavedGeoPoint[];
  parentsArea?: SavedGeoPoint;
} {
  if (
    input.budgetMax !== undefined &&
    (!Number.isFinite(input.budgetMax) ||
      input.budgetMax < PROFILE_LIMITS.budgetMin ||
      input.budgetMax > PROFILE_LIMITS.budgetMax)
  ) {
    throw new Error("Budget must be between S$100,000 and S$2,000,000");
  }
  if (
    input.waitToleranceMonths !== undefined &&
    (!Number.isInteger(input.waitToleranceMonths) ||
      input.waitToleranceMonths < PROFILE_LIMITS.waitMinMonths ||
      input.waitToleranceMonths > PROFILE_LIMITS.waitMaxMonths)
  ) {
    throw new Error("Maximum wait must be between 1 and 120 months");
  }

  const flatTypes = uniqueStrings(input.flatTypes);
  if (
    flatTypes.some(
      (value) => !(PROFILE_FLAT_TYPES as readonly string[]).includes(value),
    )
  ) {
    throw new Error("Unknown flat type");
  }

  const towns = uniqueStrings(input.towns ?? []);
  if (towns.length > PROFILE_LIMITS.towns) {
    throw new Error(`Choose no more than ${PROFILE_LIMITS.towns} towns`);
  }
  if (towns.some((town) => town.length > 80)) {
    throw new Error("Town names must be 80 characters or fewer");
  }

  const regions = uniqueStrings(input.regions ?? []);
  if (
    regions.some(
      (value) => !(PROFILE_REGIONS as readonly string[]).includes(value),
    )
  ) {
    throw new Error("Unknown region");
  }

  if (input.workplaces.length > PROFILE_LIMITS.workplaces) {
    throw new Error("Save no more than 2 workplaces");
  }
  const workplaces = input.workplaces.map(assertGeoPoint);
  const uniqueWorkplaces = new Map<string, SavedGeoPoint>();
  for (const point of workplaces) {
    const key =
      point.address?.toLocaleLowerCase("en-SG") ??
      `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    if (!uniqueWorkplaces.has(key)) uniqueWorkplaces.set(key, point);
  }

  return {
    budgetMax: input.budgetMax,
    waitToleranceMonths: input.waitToleranceMonths,
    flatTypes,
    towns,
    regions,
    workplaces: [...uniqueWorkplaces.values()],
    parentsArea: input.parentsArea
      ? assertGeoPoint(input.parentsArea)
      : undefined,
  };
}

function comparableLabel(value: string): string {
  return cleanText(value)
    .toLocaleLowerCase("en-SG")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchingPoint(
  label: string,
  points: SavedGeoPoint[],
): SavedGeoPoint | undefined {
  const wanted = comparableLabel(label);
  if (!wanted) return undefined;
  return points.find((point) => comparableLabel(point.label) === wanted);
}

/** Adds saved coordinates only when the planner label exactly matches a saved label. */
export function enrichLocationPreferences(
  input: {
    workplaces?: LabelGeoPreference[];
    parentsArea?: LabelGeoPreference;
  },
  profileGeo?: ProfileGeo,
): {
  workplaces?: LabelGeoPreference[];
  parentsArea?: LabelGeoPreference;
} {
  if (!profileGeo) return input;
  return {
    workplaces: input.workplaces?.map((place) => {
      const match = matchingPoint(place.label, profileGeo.workplaces);
      return match ? { ...place, lat: match.lat, lng: match.lng } : place;
    }),
    parentsArea: input.parentsArea
      ? (() => {
          const match = profileGeo.parentsArea
            ? matchingPoint(input.parentsArea.label, [profileGeo.parentsArea])
            : undefined;
          return match
            ? { ...input.parentsArea, lat: match.lat, lng: match.lng }
            : input.parentsArea;
        })()
      : undefined,
  };
}
