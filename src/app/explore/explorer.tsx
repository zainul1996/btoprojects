"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { List, Map as MapIcon, SearchX, SlidersHorizontal, X } from "lucide-react";

import { api } from "../../../convex/_generated/api";
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
  type StatusCounts,
} from "@/components/explore/filter-model";
import { EmptyState } from "@/components/empty-state";
import { ProjectCard, type ProjectSummary } from "@/components/project-card";
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
  return summary.flatTypes.length
    ? Math.min(...summary.flatTypes.map((f) => f.minPrice))
    : null;
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
  const [sort, setSort] = useState<ExplorerSort>("price");
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement | null>());

  // Search is debounced (300ms) for both the query and the URL; every other
  // filter applies immediately.
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const patch = (p: Partial<ExplorerFilters>) =>
    setFilters((current) => ({ ...current, ...p }));
  const reset = () => setFilters({ ...DEFAULT_FILTERS });

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

  // Status is a client-side UI filter (it depends on "today"), so it narrows
  // here rather than in the Convex query — same mechanism as multi-select
  // classification. Counts ignore the status filter itself so each segmented
  // option shows what it would match.
  const today = todayIso();

  const statusBase = useMemo(() => {
    if (results === undefined) return undefined;
    return filters.classifications.length > 1
      ? results.filter((r) =>
          filters.classifications.includes(r.project.classification),
        )
      : results;
  }, [results, filters.classifications]);

  const statusCounts = useMemo<StatusCounts | undefined>(() => {
    if (statusBase === undefined) return undefined;
    const counts: StatusCounts = {
      all: statusBase.length,
      open: 0,
      upcoming: 0,
      closed: 0,
    };
    for (const r of statusBase) {
      counts[applicationStatusOf(r.project, today)] += 1;
    }
    return counts;
  }, [statusBase, today]);

  const visible = useMemo(() => {
    if (statusBase === undefined) return undefined;
    const narrowed = (
      filters.status
        ? statusBase.filter(
            (r) => applicationStatusOf(r.project, today) === filters.status,
          )
        : [...statusBase]
    );
    switch (sort) {
      case "wait":
        narrowed.sort(
          (a, b) => a.project.estimatedWaitMonths - b.project.estimatedWaitMonths,
        );
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
  }, [statusBase, filters.status, sort, today]);

  const mapItems = useMemo(
    () =>
      (visible ?? []).map(({ project, town, flatTypes }) => ({
        slug: project.slug,
        name: project.name,
        lat: project.lat,
        lng: project.lng,
        fromPrice: flatTypes.length
          ? Math.min(...flatTypes.map((f) => f.minPrice))
          : null,
        townName: town?.name,
      })),
    [visible],
  );

  const chips = activeFilterChips(filters);
  const isSplit = filters.view === "split";

  const handleMarkerClick = (slug: string) => {
    setFocusedSlug(slug);
    cardRefs.current
      .get(slug)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const resultHeader = (
    <div
      className={cn(
        "sticky top-14 z-30 space-y-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm",
        isSplit && "lg:top-0",
      )}
    >
      <div className="flex items-center gap-2">
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
              />
            </div>
            <div className="sticky bottom-0 border-t border-border bg-popover p-4">
              <SheetClose
                render={<Button className="w-full" />}
                aria-label="Close filters and show results"
              >
                Show results
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>

        <div className="text-sm text-muted-foreground" aria-live="polite">
          {visible === undefined ? (
            <Skeleton className="inline-block h-4 w-20 align-middle" />
          ) : (
            <>
              <span className="tnum font-medium text-ink">
                {visible.length}
              </span>{" "}
              {visible.length === 1 ? "project" : "projects"}
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select
            items={SORT_ITEMS}
            value={sort}
            onValueChange={(value) => setSort(value as ExplorerSort)}
          >
            <SelectTrigger size="sm" aria-label="Sort results">
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

          <div
            role="group"
            aria-label="Results view"
            className="flex items-center rounded-lg border border-border p-0.5"
          >
            <Button
              type="button"
              variant={isSplit ? "ghost" : "secondary"}
              size="sm"
              aria-pressed={!isSplit}
              onClick={() => patch({ view: "list" })}
            >
              <List aria-hidden />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              type="button"
              variant={isSplit ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={isSplit}
              onClick={() => patch({ view: "split" })}
            >
              <MapIcon aria-hidden />
              <span className="hidden sm:inline">Map + list</span>
            </Button>
          </div>
        </div>
      </div>

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
    <div className={cn("space-y-3 p-4", !isSplit && "mx-auto w-full max-w-3xl")}>
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
          title="No projects match"
          hint="Try clearing a filter or widening the price range."
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
            ref={(el) => {
              cardRefs.current.set(summary.project.slug, el);
            }}
            onMouseEnter={() => setFocusedSlug(summary.project.slug)}
            onMouseLeave={() => setFocusedSlug(null)}
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

  return (
    <div className="flex flex-col lg:flex-row lg:items-start">
      {/* Desktop filter rail */}
      <aside className="sticky top-14 order-3 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border px-5 py-6 lg:order-1 lg:block">
        <ExploreFilters
          filters={filters}
          onPatch={patch}
          onReset={reset}
          statusCounts={statusCounts}
        />
      </aside>

      {/* Map — above the list on mobile, right column on desktop */}
      {isSplit ? (
        <div className="order-1 h-[45svh] lg:order-3 lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:flex-1">
          <ProjectMap
            projects={mapItems}
            focusedSlug={focusedSlug}
            onMarkerClick={handleMarkerClick}
          />
        </div>
      ) : null}

      {/* List column */}
      <section
        aria-label="Project results"
        className={cn(
          "order-2 min-w-0",
          isSplit
            ? "lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-border"
            : "flex-1",
        )}
      >
        {resultHeader}
        {resultList}
      </section>
    </div>
  );
}
