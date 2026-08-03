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
export const SALE_TYPES = ["bto", "sbf"] as const;

// Schema-wide union (SBF pools can be "Unclassified"); the filter UI only
// offers the CLASSIFICATIONS options above.
export type Classification = "Standard" | "Plus" | "Prime" | "Unclassified";

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type SaleType = (typeof SALE_TYPES)[number];
export type ExplorerView = "map" | "list" | "exercise";
export type ExplorerSort = "price" | "wait" | "name";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  open: "Open now",
  upcoming: "Upcoming",
  closed: "Closed",
};

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  bto: "BTO",
  sbf: "SBF",
};

/** Per-option result counts for the status segmented control. */
export type StatusCounts = Record<ApplicationStatus | "all", number>;

/** Per-option result counts for the sale-type segmented control. */
export type SaleCounts = Record<SaleType | "all", number>;

/** Singapore "YYYY-MM-DD", comparable against HDB's stored ISO deadlines. */
export function todayIso(): string {
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * Can a buyer apply for this option right now? BTO status comes from the
 * project lifecycle and deadline. SBF status comes from its sales exercise.
 * Construction and MOP records have no open application window.
 */
export function applicationStatusOf(
  project: {
    lifecycleStatus: string;
    applicationDeadline?: string;
    saleType?: string;
  },
  today: string,
  exercise?: {
    status: ApplicationStatus | null;
    applicationEnd: string | null;
  },
): ApplicationStatus {
  if (project.saleType === "sbf" && exercise?.status) {
    return effectiveExerciseStatus(
      {
        status: exercise.status,
        applicationEnd: exercise.applicationEnd ?? undefined,
      },
      today,
    );
  }
  if (project.lifecycleStatus === "announced") return "upcoming";
  if (project.lifecycleStatus === "launched") {
    return !project.applicationDeadline || project.applicationDeadline >= today
      ? "open"
      : "closed";
  }
  return "closed";
}

export function effectiveExerciseStatus(
  exercise: {
    status: ApplicationStatus;
    applicationEnd?: string;
  },
  today: string,
): ApplicationStatus {
  return exercise.status === "open" &&
    exercise.applicationEnd !== undefined &&
    exercise.applicationEnd < today
    ? "closed"
    : exercise.status;
}

export const PRICE_MIN = 150_000;
export const PRICE_MAX = 1_000_000;
export const PRICE_STEP = 10_000;
export const WAIT_MIN = 20;
export const WAIT_MAX = 60;

export type ExplorerFilters = {
  q: string;
  status: ApplicationStatus | undefined;
  saleType: SaleType | undefined;
  town: string | undefined;
  region: string | undefined;
  classifications: Classification[];
  flat: string | undefined;
  maxPrice: number | undefined;
  maxWait: number | undefined;
  view: ExplorerView;
  sort: ExplorerSort;
};

export const DEFAULT_FILTERS: ExplorerFilters = {
  q: "",
  status: undefined,
  saleType: undefined,
  town: undefined,
  region: undefined,
  classifications: [],
  flat: undefined,
  maxPrice: undefined,
  maxWait: undefined,
  view: "map",
  sort: "price",
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
  const sale = first(params.sale);
  const view = first(params.view);
  const sort = first(params.sort);

  return {
    q: first(params.q) ?? "",
    status: (APPLICATION_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as ApplicationStatus)
      : undefined,
    saleType: (SALE_TYPES as readonly string[]).includes(sale ?? "")
      ? (sale as SaleType)
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
    // `split` was the original name for the map-with-results view.
    view:
      view === "list" || view === "exercise"
        ? view
        : "map",
    sort:
      sort === "wait" || sort === "name"
        ? sort
        : "price",
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
  if (filters.saleType) sp.set("sale", filters.saleType);
  if (filters.town) sp.set("town", filters.town);
  if (filters.region) sp.set("region", filters.region);
  if (filters.classifications.length > 0)
    sp.set("classification", filters.classifications.join(","));
  if (filters.flat) sp.set("flat", filters.flat);
  if (filters.maxPrice !== undefined) sp.set("price", String(filters.maxPrice));
  if (filters.maxWait !== undefined) sp.set("wait", String(filters.maxWait));
  if (filters.view !== "map") sp.set("view", filters.view);
  if (filters.sort !== "price") sp.set("sort", filters.sort);
  return sp.toString();
}

export function hasActiveFilters(filters: ExplorerFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.status !== undefined ||
    filters.saleType !== undefined ||
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
  if (filters.saleType) {
    chips.push({
      key: "sale",
      label: SALE_TYPE_LABELS[filters.saleType],
      patch: { saleType: undefined },
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
