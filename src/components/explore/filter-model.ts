import { formatSgd } from "@/components/price";

/**
 * Explorer filter model — the URL is the shareable reflection of this state
 * (DESIGN.md: "URL is state"). Parsing is defensive: unknown values drop out
 * rather than breaking the page on a hand-edited link.
 */

export const REGIONS = ["Central", "East", "North", "North-East", "West"] as const;
export const CLASSIFICATIONS = ["Standard", "Plus", "Prime"] as const;
export const FLAT_TYPES = ["2-room Flexi", "3-room", "4-room", "5-room", "3Gen"] as const;
export const APPLICATION_STATUSES = ["open", "upcoming", "closed"] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type ExplorerView = "split" | "list";
export type ExplorerSort = "price" | "wait" | "name";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  open: "Open now",
  upcoming: "Upcoming",
  closed: "Closed",
};

/** Per-option result counts for the status segmented control. */
export type StatusCounts = Record<ApplicationStatus | "all", number>;

/** Local "YYYY-MM-DD" — string-comparable against stored ISO deadlines. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Can a buyer apply for this project right now? lifecycleStatus is the
 * primary signal, refined by the application deadline where one exists.
 * construction/sbf/mop have no open application window, so they read as
 * "closed" for this filter.
 */
export function applicationStatusOf(
  project: { lifecycleStatus: string; applicationDeadline?: string },
  today: string,
): ApplicationStatus {
  if (project.lifecycleStatus === "announced") return "upcoming";
  if (project.lifecycleStatus === "launched") {
    return !project.applicationDeadline || project.applicationDeadline >= today
      ? "open"
      : "closed";
  }
  return "closed";
}

export const PRICE_MIN = 150_000;
export const PRICE_MAX = 1_000_000;
export const PRICE_STEP = 10_000;
export const WAIT_MIN = 20;
export const WAIT_MAX = 60;

export type ExplorerFilters = {
  q: string;
  status: ApplicationStatus | undefined;
  town: string | undefined;
  region: string | undefined;
  classifications: Classification[];
  flat: string | undefined;
  maxPrice: number | undefined;
  maxWait: number | undefined;
  view: ExplorerView;
};

export const DEFAULT_FILTERS: ExplorerFilters = {
  q: "",
  status: undefined,
  town: undefined,
  region: undefined,
  classifications: [],
  flat: undefined,
  maxPrice: undefined,
  maxWait: undefined,
  view: "split",
};

type SearchParamRecord = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function parseExplorerParams(params: SearchParamRecord): ExplorerFilters {
  const classificationParam = first(params.classification);
  const classifications = classificationParam
    ? classificationParam
        .split(",")
        .map((part) => part.trim())
        .filter((part): part is Classification =>
          (CLASSIFICATIONS as readonly string[]).includes(part),
        )
    : [];

  const region = first(params.region);
  const flat = first(params.flat);
  const status = first(params.status);
  const view = first(params.view);

  return {
    q: first(params.q) ?? "",
    status: (APPLICATION_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as ApplicationStatus)
      : undefined,
    town: first(params.town) || undefined,
    region: (REGIONS as readonly string[]).includes(region ?? "")
      ? region
      : undefined,
    classifications: [...new Set(classifications)],
    flat: (FLAT_TYPES as readonly string[]).includes(flat ?? "")
      ? flat
      : undefined,
    maxPrice: parseNumber(first(params.price)),
    maxWait: parseNumber(first(params.wait)),
    view: view === "list" ? "list" : "split",
  };
}

/** Stable identity for a params record — used to key the client explorer. */
export function paramsIdentity(params: SearchParamRecord): string {
  return Object.entries(params)
    .flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((v) => `${key}=${v}`)
        : value === undefined
          ? []
          : [`${key}=${value}`],
    )
    .sort()
    .join("&");
}

export function serializeExplorerParams(filters: ExplorerFilters): string {
  const sp = new URLSearchParams();
  if (filters.q.trim()) sp.set("q", filters.q.trim());
  if (filters.status) sp.set("status", filters.status);
  if (filters.town) sp.set("town", filters.town);
  if (filters.region) sp.set("region", filters.region);
  if (filters.classifications.length > 0)
    sp.set("classification", filters.classifications.join(","));
  if (filters.flat) sp.set("flat", filters.flat);
  if (filters.maxPrice !== undefined) sp.set("price", String(filters.maxPrice));
  if (filters.maxWait !== undefined) sp.set("wait", String(filters.maxWait));
  if (filters.view !== "split") sp.set("view", filters.view);
  return sp.toString();
}

export function hasActiveFilters(filters: ExplorerFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.status !== undefined ||
    filters.town !== undefined ||
    filters.region !== undefined ||
    filters.classifications.length > 0 ||
    filters.flat !== undefined ||
    filters.maxPrice !== undefined ||
    filters.maxWait !== undefined
  );
}

export type FilterChip = {
  /** Stable React key + which patch clears it. */
  key: string;
  label: string;
  patch: Partial<ExplorerFilters>;
};

export function activeFilterChips(filters: ExplorerFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.q.trim()) {
    chips.push({
      key: "q",
      label: `“${filters.q.trim()}”`,
      patch: { q: "" },
    });
  }
  if (filters.status) {
    chips.push({
      key: "status",
      label: APPLICATION_STATUS_LABELS[filters.status],
      patch: { status: undefined },
    });
  }
  if (filters.town) {
    chips.push({ key: "town", label: filters.town, patch: { town: undefined } });
  }
  if (filters.region) {
    chips.push({
      key: "region",
      label: filters.region,
      patch: { region: undefined },
    });
  }
  for (const c of filters.classifications) {
    chips.push({
      key: `classification:${c}`,
      label: c,
      patch: {
        classifications: filters.classifications.filter((x) => x !== c),
      },
    });
  }
  if (filters.flat) {
    chips.push({ key: "flat", label: filters.flat, patch: { flat: undefined } });
  }
  if (filters.maxPrice !== undefined) {
    chips.push({
      key: "price",
      label: `≤ ${formatSgd(filters.maxPrice)}`,
      patch: { maxPrice: undefined },
    });
  }
  if (filters.maxWait !== undefined) {
    chips.push({
      key: "wait",
      label: `≤ ${filters.maxWait} mo wait`,
      patch: { maxWait: undefined },
    });
  }
  return chips;
}
