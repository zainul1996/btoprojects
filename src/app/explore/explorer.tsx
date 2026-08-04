"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  CalendarRange,
  List,
  Map as MapIcon,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { ExerciseResults } from "@/components/explore/exercise-results";
import { ExploreFilters } from "@/components/explore/filters";
import {
  activeFilterChips,
  applicationStatusOf,
  hasActiveFilters,
  parseExplorerParams,
  serializeExplorerParams,
  todayIso,
  DEFAULT_FILTERS,
  type ExplorerFilters,
  type ExplorerSort,
  type SaleCounts,
  type StatusCounts,
} from "@/components/explore/filter-model";
import { EmptyState } from "@/components/empty-state";
import {
  parseHawkerDataset,
  type HawkerDataset,
} from "@/components/map/hawker-data";
import { MapLayerControl } from "@/components/map/map-layer-control";
import { MapProjectSelection } from "@/components/map/map-project-selection";
import {
  parseParkDataset,
  type ParkDataset,
} from "@/components/map/park-data";
import {
  parsePrimarySchoolDataset,
  type PrimarySchoolDataset,
} from "@/components/map/school-data";
import {
  parseTrainStationDataset,
  type TrainStationDataset,
} from "@/components/map/train-data";
import { useMapLayers } from "@/components/map/use-map-layers";
import {
  ProjectCard,
  shortExerciseLabel,
  type ProjectSummary,
} from "@/components/project-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ProjectMap = dynamic(
  () => import("@/components/map/project-map").then((m) => m.ProjectMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
    ),
  },
);

const SORT_ITEMS: { value: ExplorerSort; label: string }[] = [
  { value: "price", label: "Price: low to high" },
  { value: "wait", label: "Wait: short to long" },
  { value: "name", label: "Name: A–Z" },
];

function fromPriceOf(summary: ProjectSummary): number | null {
  if (!summary.flatTypes.length) return null;
  const min = Math.min(...summary.flatTypes.map((f) => f.minPrice));
  // 0 means "price TBC" — unknown, not free. Sorts with the unknowns (last).
  return min > 0 ? min : null;
}

/** Unknown and mixed waits sort last; 0 is never a comparable duration. */
function waitSortKeyOf(summary: ProjectSummary): number {
  if (summary.project.saleType === "sbf") return Infinity;
  const wait = summary.project.estimatedWaitMonths;
  return wait > 0 ? wait : Infinity;
}

function resultCountLabel(items: ProjectSummary[]): string {
  let bto = 0;
  let sbf = 0;
  for (const { project } of items) {
    if (project.saleType === "sbf") sbf += 1;
    else bto += 1;
  }
  const parts: string[] = [];
  if (bto > 0) parts.push(`${bto} project${bto === 1 ? "" : "s"}`);
  if (sbf > 0) parts.push(`${sbf} SBF pool${sbf === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(" · ") : "0 results";
}

type StaticDatasetState<T> = {
  data: T | null;
  status: "idle" | "loading" | "ready" | "error";
  retry: () => void;
};

function useStaticMapDataset<T>(
  enabled: boolean,
  url: string,
  parse: (value: unknown) => T,
): StaticDatasetState<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<StaticDatasetState<T>["status"]>(
    "idle",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || data) return;
    const controller = new AbortController();
    queueMicrotask(() => setStatus("loading"));
    void fetch(url, { signal: controller.signal, cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        setData(parse(value));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [attempt, data, enabled, parse, url]);

  const retry = useCallback(() => {
    setData(null);
    setStatus("loading");
    setAttempt((current) => current + 1);
  }, []);

  return { data, status, retry };
}

function CardSkeleton() {
  return (
    <div
      className="flex h-[172px] flex-col gap-3 rounded-xl border border-border bg-card p-5"
      aria-hidden
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-48 rounded-full" />
      <Skeleton className="h-6 w-32" />
      <div className="mt-auto flex justify-end gap-2 border-t border-border/60 pt-3">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
      </div>
    </div>
  );
}

type ExplorerProps = {
  /** Parsed once on mount — the page keys this component by params identity. */
  initialParams: Record<string, string | string[] | undefined>;
};

/**
 * The signature surface: filters → list → map, with the URL as shareable
 * state. Server filtering via `api.projects.list`; sort and multi-select
 * classification are client-side (the dataset is a dozen projects).
 */
export function Explorer({ initialParams }: ExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [filters, setFilters] = useState<ExplorerFilters>(() =>
    parseExplorerParams(initialParams),
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [mapLayers, setMapLayers] = useMapLayers();

  // Search is debounced (300ms) for both the query and the URL; every other
  // filter applies immediately.
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const patch = (p: Partial<ExplorerFilters>) =>
    setFilters((current) => ({ ...current, ...p }));
  const reset = () =>
    setFilters((current) => ({
      ...DEFAULT_FILTERS,
      view: current.view,
      sort: current.sort,
    }));

  useEffect(() => {
    const qs = serializeExplorerParams({ ...filters, q: debouncedQ });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, debouncedQ, pathname, router]);

  const queryArgs = useMemo(() => {
    const args: {
      search?: string;
      town?: string;
      region?: string;
      classification?: (typeof filters.classifications)[number];
      flatType?: string;
      maxPrice?: number;
      maxWaitMonths?: number;
    } = {};
    const search = debouncedQ.trim();
    if (search) args.search = search;
    if (filters.town) args.town = filters.town;
    if (filters.region) args.region = filters.region;
    // Backend takes one classification; multi-select narrows client-side.
    if (filters.classifications.length === 1)
      args.classification = filters.classifications[0];
    if (filters.flat) args.flatType = filters.flat;
    if (filters.maxPrice !== undefined) args.maxPrice = filters.maxPrice;
    if (filters.maxWait !== undefined) args.maxWaitMonths = filters.maxWait;
    return args;
  }, [debouncedQ, filters]);

  const results = useQuery(api.projects.list, queryArgs);
  const exerciseRows = useQuery(
    api.exercises.list,
    filters.view === "exercise" ? {} : "skip",
  );
  const trainStations = useStaticMapDataset<TrainStationDataset>(
    filters.view === "map" && mapLayers.mrt,
    "/data/amenities/train-stations.json",
    parseTrainStationDataset,
  );
  const hawkerCentres = useStaticMapDataset<HawkerDataset>(
    filters.view === "map" && mapLayers.hawker,
    "/data/amenities/hawker-centres.json",
    parseHawkerDataset,
  );
  const parks = useStaticMapDataset<ParkDataset>(
    filters.view === "map" && mapLayers.parks,
    "/data/amenities/parks.json",
    parseParkDataset,
  );
  const primarySchools = useStaticMapDataset<PrimarySchoolDataset>(
    filters.view === "map" && mapLayers.primarySchools,
    "/data/amenities/primary-schools.json",
    parsePrimarySchoolDataset,
  );

  // Status and sale type are client-side UI filters (status depends on
  // "today"; sale-type counts must reflect every other filter), so they
  // narrow here rather than in the Convex query — same mechanism as
  // multi-select classification. Counts ignore their own filter so each
  // segmented option shows what it would match.
  const today = todayIso();

  const classificationBase = useMemo(() => {
    if (results === undefined) return undefined;
    return filters.classifications.length > 1
      ? results.filter((r) =>
          filters.classifications.includes(r.project.classification),
        )
      : results;
  }, [results, filters.classifications]);

  const saleCounts = useMemo<SaleCounts | undefined>(() => {
    if (classificationBase === undefined) return undefined;
    const counts: SaleCounts = { all: classificationBase.length, bto: 0, sbf: 0 };
    for (const r of classificationBase) {
      counts[r.project.saleType ?? "bto"] += 1;
    }
    return counts;
  }, [classificationBase]);

  const statusBase = useMemo(() => {
    if (classificationBase === undefined) return undefined;
    return filters.saleType
      ? classificationBase.filter(
          (r) => (r.project.saleType ?? "bto") === filters.saleType,
        )
      : classificationBase;
  }, [classificationBase, filters.saleType]);

  const statusCounts = useMemo<StatusCounts | undefined>(() => {
    if (statusBase === undefined) return undefined;
    const counts: StatusCounts = {
      all: statusBase.length,
      open: 0,
      upcoming: 0,
      closed: 0,
    };
    for (const r of statusBase) {
      counts[
        applicationStatusOf(r.project, today, {
          status: r.exerciseStatus,
          applicationEnd: r.exerciseApplicationEnd,
        })
      ] += 1;
    }
    return counts;
  }, [statusBase, today]);

  const visible = useMemo(() => {
    if (statusBase === undefined) return undefined;
    const narrowed = (
      filters.status
        ? statusBase.filter(
            (r) =>
              applicationStatusOf(r.project, today, {
                status: r.exerciseStatus,
                applicationEnd: r.exerciseApplicationEnd,
              }) === filters.status,
          )
        : [...statusBase]
    );
    switch (filters.sort) {
      case "wait":
        // Unknown waits sort last, never first as a misleadingly short wait.
        narrowed.sort((a, b) => waitSortKeyOf(a) - waitSortKeyOf(b));
        break;
      case "name":
        narrowed.sort((a, b) => a.project.name.localeCompare(b.project.name));
        break;
      default:
        narrowed.sort(
          (a, b) => (fromPriceOf(a) ?? Infinity) - (fromPriceOf(b) ?? Infinity),
        );
    }
    return narrowed;
  }, [statusBase, filters.status, filters.sort, today]);

  const mapItems = useMemo(
    () =>
      (visible ?? []).map(({ project, town, flatTypes, exerciseLabel }) => {
        const minPrice = flatTypes.length
          ? Math.min(...flatTypes.map((f) => f.minPrice))
          : null;
        return {
          slug: project.slug,
          name: project.name,
          lat: project.lat,
          lng: project.lng,
          lifecycleStatus: project.lifecycleStatus,
          saleType: project.saleType,
          totalUnits: project.totalUnits,
          // Pool names carry no exercise, so the popup needs it to tell
          // same-town pools from different years apart.
          exerciseLabel: exerciseLabel
            ? shortExerciseLabel(exerciseLabel)
            : null,
          // 0 means "price TBC" (announced projects, SBF pools) — never
          // hand the popup a $0 to format.
          fromPrice: minPrice !== null && minPrice > 0 ? minPrice : null,
          townName: town?.name,
        };
      }),
    [visible],
  );

  const chips = activeFilterChips(filters);
  const isMap = filters.view === "map";
  const isExercise = filters.view === "exercise";
  const showMap = isMap && visible !== undefined && visible.length > 0;
  const focusedSlug = hoveredSlug ?? selectedSlug;
  const selectedSummary = useMemo(
    () =>
      selectedSlug && visible
        ? (visible.find((summary) => summary.project.slug === selectedSlug) ??
          null)
        : null,
    [selectedSlug, visible],
  );

  const handleMarkerClick = (slug: string) => {
    setSelectedSlug(slug);
  };

  const resultHeader = (
    <div
      className={cn(
        "sticky top-14 z-30 flex flex-col gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm",
        isMap && "lg:top-0",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                aria-label={
                  chips.length > 0
                    ? `Open filters, ${chips.length} active`
                    : "Open filters"
                }
              />
            }
          >
            <SlidersHorizontal aria-hidden />
            Filters
            {chips.length > 0 ? (
              <span className="tnum grid size-5 place-items-center rounded-full bg-teal-subtle text-xs font-medium text-teal-deeper">
                {chips.length}
              </span>
            ) : null}
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85svh] gap-0 overflow-y-auto p-0"
          >
            <SheetHeader className="border-b border-border">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-5 py-5">
              <ExploreFilters
                filters={filters}
                onPatch={patch}
                onReset={reset}
                statusCounts={statusCounts}
                saleCounts={saleCounts}
              />
            </div>
            <div className="sticky bottom-0 border-t border-border bg-popover p-4">
              <SheetClose
                render={<Button className="w-full" />}
                aria-label="Close filters and show results"
              >
                {visible === undefined
                  ? "Show results"
                  : `Show ${resultCountLabel(visible)}`}
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>

        <div className="text-sm text-muted-foreground" aria-live="polite">
          {visible === undefined ? (
            <Skeleton className="inline-block h-4 w-20 align-middle" />
          ) : (
            <span className="tnum font-medium text-ink">
              {resultCountLabel(visible)}
            </span>
          )}
        </div>

        {!isExercise ? (
          <div className="ml-auto">
            <Select
              items={SORT_ITEMS}
              value={filters.sort}
              onValueChange={(value) =>
                patch({ sort: value as ExplorerSort })
              }
            >
              <SelectTrigger
                size="sm"
                className="max-w-36"
                aria-label="Sort results"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Results view"
        className="flex w-full items-center rounded-lg border border-border bg-background p-0.5 lg:justify-center"
      >
        <Button
          type="button"
          variant={isMap ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 lg:flex-none"
          aria-pressed={isMap}
          onClick={() => patch({ view: "map" })}
        >
          <MapIcon aria-hidden />
          <span>Map</span>
        </Button>
        <Button
          type="button"
          variant={filters.view === "list" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 lg:flex-none"
          aria-pressed={filters.view === "list"}
          onClick={() => patch({ view: "list" })}
        >
          <List aria-hidden />
          <span>List</span>
        </Button>
        <Button
          type="button"
          variant={isExercise ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 lg:flex-none"
          aria-pressed={isExercise}
          onClick={() => patch({ view: "exercise" })}
        >
          <CalendarRange aria-hidden />
          <span>By exercise</span>
        </Button>
      </div>

      {showMap && selectedSummary ? (
        <MapProjectSelection
          summary={selectedSummary}
          onClose={() => setSelectedSlug(null)}
          className="mt-1 hidden shadow-none lg:block"
        />
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => patch(chip.patch)}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-teal-deep/25 bg-teal-subtle px-2 text-xs font-medium text-teal-deeper transition-colors hover:bg-teal-subtle/70"
              aria-label={`Remove filter: ${chip.label}`}
            >
              <span className="tnum">{chip.label}</span>
              <X className="size-3" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );

  const resultList = (
    <div className={cn("space-y-3 p-4", !showMap && "mx-auto w-full max-w-3xl")}>
      {visible === undefined ? (
        <>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No results match"
          hint="Try clearing a filter or widening the price or wait range."
          action={
            hasActiveFilters(filters) ? (
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                Reset filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        visible.map((summary) => (
          <div
            key={summary.project.slug}
            onMouseEnter={() => setHoveredSlug(summary.project.slug)}
            onMouseLeave={() => setHoveredSlug(null)}
          >
            <ProjectCard
              summary={summary}
              className={cn(
                focusedSlug === summary.project.slug &&
                  "shadow-md shadow-navy/5 ring-2 ring-teal/60",
              )}
            />
          </div>
        ))
      )}
    </div>
  );

  const exerciseContent =
    visible === undefined ? (
      <ExerciseResults summaries={[]} exerciseRows={undefined} />
    ) : visible.length === 0 ? (
      resultList
    ) : (
      <ExerciseResults summaries={visible} exerciseRows={exerciseRows} />
    );

  return (
    <>
      <header className="border-b border-border bg-background px-4 py-3 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Find projects
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Explore BTO projects and SBF town pools by place, criteria or sales
            exercise.
          </p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row lg:items-start">
        {/* Desktop filter rail */}
        <aside
          className={cn(
            "order-4 hidden w-60 shrink-0 overflow-y-auto border-r border-border px-5 py-6 lg:order-1 lg:block lg:max-h-[calc(100svh-3.5rem)]",
            "lg:sticky lg:top-14",
            showMap && "lg:h-[calc(100svh-8rem)]",
          )}
        >
          <ExploreFilters
            filters={filters}
            onPatch={patch}
            onReset={reset}
            statusCounts={statusCounts}
            saleCounts={saleCounts}
          />
        </aside>

        {/* `contents` puts the mobile controls above the map while retaining a
            dedicated, scrollable list column on desktop. */}
        <section
          aria-label="Project results"
          className={cn(
            "contents min-w-0 lg:order-2 lg:block",
            showMap
              ? "lg:h-[calc(100svh-8rem)] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-border"
              : "lg:flex-1",
          )}
        >
          {resultHeader}
          <div className={cn("order-3 lg:contents", showMap && "hidden lg:contents")}>
            {isExercise ? exerciseContent : resultList}
          </div>
        </section>

        {/* A zero-result map is omitted: the teaching empty state carries more
            information than a blank island view. */}
        {showMap ? (
          <div
            className="relative order-2 h-[calc(100svh-19.5rem)] min-h-[27rem] lg:order-3 lg:h-[calc(100svh-8rem)] lg:min-h-0 lg:flex-1"
            data-has-selection={selectedSummary ? "true" : "false"}
          >
            <ProjectMap
              projects={mapItems}
              mrtStations={trainStations.data?.items ?? []}
              showMrtStations={mapLayers.mrt}
              hawkerCentres={hawkerCentres.data?.items ?? []}
              showHawkerCentres={mapLayers.hawker}
              parks={parks.data?.items ?? []}
              showParks={mapLayers.parks}
              primarySchools={primarySchools.data?.items ?? []}
              showPrimarySchools={mapLayers.primarySchools}
              focusedSlug={focusedSlug}
              onMarkerClick={handleMarkerClick}
              onSelectionClear={() => setSelectedSlug(null)}
            />
            <MapLayerControl
              mrtEnabled={mapLayers.mrt}
              onMrtEnabledChange={(mrt) =>
                setMapLayers((current) => ({ ...current, mrt }))
              }
              trainStatus={trainStations.status}
              trainDataset={trainStations.data}
              onRetryTrains={trainStations.retry}
              hawkerEnabled={mapLayers.hawker}
              onHawkerEnabledChange={(hawker) =>
                setMapLayers((current) => ({ ...current, hawker }))
              }
              hawkerStatus={hawkerCentres.status}
              hawkerDataset={hawkerCentres.data}
              onRetryHawkers={hawkerCentres.retry}
              parksEnabled={mapLayers.parks}
              onParksEnabledChange={(parks) =>
                setMapLayers((current) => ({ ...current, parks }))
              }
              parkStatus={parks.status}
              parkDataset={parks.data}
              onRetryParks={parks.retry}
              primarySchoolsEnabled={mapLayers.primarySchools}
              onPrimarySchoolsEnabledChange={(primarySchools) =>
                setMapLayers((current) => ({
                  ...current,
                  primarySchools,
                }))
              }
              primarySchoolStatus={primarySchools.status}
              primarySchoolDataset={primarySchools.data}
              onRetryPrimarySchools={primarySchools.retry}
            />
            {selectedSummary ? (
              <MapProjectSelection
                summary={selectedSummary}
                onClose={() => setSelectedSlug(null)}
                className="absolute inset-x-3 bottom-3 z-20 lg:hidden"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
