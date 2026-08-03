import {
  isSingaporeCoordinate,
  type SavedGeoPoint,
} from "../../convex/lib/profilePreferences";

const PREFERENCES_DRAFT_KEY = "bto.preferences.draft.v1";

export type PreferencesDraftForm = {
  budget: string;
  waitMonths: string;
  flatTypes: string[];
  towns: string;
  regions: string[];
  workplaces: SavedGeoPoint[];
  parentsArea?: SavedGeoPoint;
};

export type PreferencesPendingMatch = {
  kind: "workplace" | "parents";
  address: string;
  lat: number;
  lng: number;
};

export type PreferencesDraft = {
  owner: string;
  form: PreferencesDraftForm;
  workplaceInput: string;
  parentsInput: string;
  pendingMatch: PreferencesPendingMatch | null;
  baselineUpdatedAt: number | null;
  savedAt: number;
};

function storageOrUndefined(suppliedStorage?: Storage): Storage | undefined {
  return (
    suppliedStorage ??
    (typeof window === "undefined" ? undefined : window.sessionStorage)
  );
}

function isStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every(
      (entry) => typeof entry === "string" && entry.length <= maxLength,
    )
  );
}

function isGeoPoint(value: unknown): value is SavedGeoPoint {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.label === "string" &&
    point.label.length >= 3 &&
    point.label.length <= 120 &&
    (point.address === undefined ||
      (typeof point.address === "string" &&
        point.address.length >= 3 &&
        point.address.length <= 120)) &&
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    isSingaporeCoordinate(point.lat, point.lng)
  );
}

function isPendingMatch(value: unknown): value is PreferencesPendingMatch {
  if (typeof value !== "object" || value === null) return false;
  const match = value as Record<string, unknown>;
  return (
    (match.kind === "workplace" || match.kind === "parents") &&
    typeof match.address === "string" &&
    match.address.length >= 3 &&
    match.address.length <= 120 &&
    typeof match.lat === "number" &&
    typeof match.lng === "number" &&
    isSingaporeCoordinate(match.lat, match.lng)
  );
}

function isDraftForm(value: unknown): value is PreferencesDraftForm {
  if (typeof value !== "object" || value === null) return false;
  const form = value as Record<string, unknown>;
  return (
    typeof form.budget === "string" &&
    form.budget.length <= 40 &&
    typeof form.waitMonths === "string" &&
    form.waitMonths.length <= 40 &&
    typeof form.towns === "string" &&
    form.towns.length <= 1_000 &&
    isStringArray(form.flatTypes, 20, 80) &&
    isStringArray(form.regions, 20, 80) &&
    Array.isArray(form.workplaces) &&
    form.workplaces.length <= 2 &&
    form.workplaces.every(isGeoPoint) &&
    (form.parentsArea === undefined || isGeoPoint(form.parentsArea))
  );
}

function parseDraft(value: unknown, expectedOwner: string): PreferencesDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const draft = value as Record<string, unknown>;
  if (
    draft.owner !== expectedOwner ||
    !isDraftForm(draft.form) ||
    typeof draft.workplaceInput !== "string" ||
    draft.workplaceInput.length > 120 ||
    typeof draft.parentsInput !== "string" ||
    draft.parentsInput.length > 120 ||
    (draft.pendingMatch !== null && !isPendingMatch(draft.pendingMatch)) ||
    (draft.baselineUpdatedAt !== null &&
      (typeof draft.baselineUpdatedAt !== "number" ||
        !Number.isFinite(draft.baselineUpdatedAt))) ||
    typeof draft.savedAt !== "number" ||
    !Number.isFinite(draft.savedAt)
  ) {
    return null;
  }
  return draft as PreferencesDraft;
}

export function readPreferencesDraft(
  expectedOwner: string,
  suppliedStorage?: Storage,
): PreferencesDraft | null {
  const storage = storageOrUndefined(suppliedStorage);
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFERENCES_DRAFT_KEY);
    if (!raw) return null;
    const draft = parseDraft(JSON.parse(raw) as unknown, expectedOwner);
    if (!draft) storage.removeItem(PREFERENCES_DRAFT_KEY);
    return draft;
  } catch {
    try {
      storage.removeItem(PREFERENCES_DRAFT_KEY);
    } catch {
      // The form remains usable if browser storage is unavailable.
    }
    return null;
  }
}

export function writePreferencesDraft(
  draft: PreferencesDraft,
  suppliedStorage?: Storage,
): void {
  const storage = storageOrUndefined(suppliedStorage);
  if (!storage) return;
  try {
    storage.setItem(PREFERENCES_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // The form remains usable if browser storage is unavailable or full.
  }
}

export function clearPreferencesDraft(suppliedStorage?: Storage): void {
  const storage = storageOrUndefined(suppliedStorage);
  if (!storage) return;
  try {
    storage.removeItem(PREFERENCES_DRAFT_KEY);
  } catch {
    // Nothing else to clean up.
  }
}

export { PREFERENCES_DRAFT_KEY };
