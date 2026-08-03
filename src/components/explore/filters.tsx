"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { RotateCcw, Search } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { formatSgd } from "@/components/price";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  CLASSIFICATIONS,
  FLAT_TYPES,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  REGIONS,
  SALE_TYPES,
  SALE_TYPE_LABELS,
  WAIT_MAX,
  WAIT_MIN,
  hasActiveFilters,
  type ApplicationStatus,
  type Classification,
  type ExplorerFilters,
  type SaleCounts,
  type SaleType,
  type StatusCounts,
} from "./filter-model";

const ALL = "__all__";

const STATUS_OPTIONS: { value: ApplicationStatus | undefined; label: string }[] =
  [
    { value: undefined, label: "All" },
    ...APPLICATION_STATUSES.map((s) => ({
      value: s,
      label: APPLICATION_STATUS_LABELS[s],
    })),
  ];

const SALE_TYPE_OPTIONS: { value: SaleType | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  ...SALE_TYPES.map((s) => ({ value: s, label: SALE_TYPE_LABELS[s] })),
];

function firstValue(value: number | readonly number[]): number {
  return typeof value === "number" ? value : value[0];
}

type ExploreFiltersProps = {
  filters: ExplorerFilters;
  onPatch: (patch: Partial<ExplorerFilters>) => void;
  onReset: () => void;
  /** Counts per status option, computed with every other filter applied. */
  statusCounts?: StatusCounts;
  /** Counts per sale-type option, computed with every other filter applied. */
  saleCounts?: SaleCounts;
  className?: string;
};

/**
 * The explorer filter rail. Calm and single-column; every control maps 1:1
 * to a URL param. Sliders draft locally while dragging and commit on release
 * so the results query (and URL) update once per gesture, not per pixel.
 */
export function ExploreFilters({
  filters,
  onPatch,
  onReset,
  statusCounts,
  saleCounts,
  className,
}: ExploreFiltersProps) {
  const towns = useQuery(api.towns.list, {});
  const [draftPrice, setDraftPrice] = useState<number | null>(null);
  const [draftWait, setDraftWait] = useState<number | null>(null);

  const shownPrice = draftPrice ?? filters.maxPrice ?? PRICE_MAX;
  const shownWait = draftWait ?? filters.maxWait ?? WAIT_MAX;

  const townItems = [
    { value: ALL, label: "All towns" },
    ...(towns ?? []).map(({ town, projectCount }) => ({
      value: town.name,
      label: projectCount > 0 ? `${town.name} (${projectCount})` : town.name,
    })),
  ];

  const toggleClassification = (c: Classification, checked: boolean) => {
    onPatch({
      classifications: checked
        ? [...filters.classifications, c]
        : filters.classifications.filter((x) => x !== c),
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Sale type</legend>
        <div
          role="group"
          aria-label="Sale type"
          className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1"
        >
          {SALE_TYPE_OPTIONS.map((option) => {
            const active = filters.saleType === option.value;
            const count = saleCounts?.[option.value ?? "all"];
            return (
              <Button
                key={option.label}
                type="button"
                variant={active ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={active}
                onClick={() => onPatch({ saleType: option.value })}
              >
                <span className="tnum">
                  {count !== undefined
                    ? `${option.label} (${count})`
                    : option.label}
                </span>
              </Button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Application status</legend>
        <div
          role="group"
          aria-label="Application status"
          className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1"
        >
          {STATUS_OPTIONS.map((option) => {
            const active = filters.status === option.value;
            const count = statusCounts?.[option.value ?? "all"];
            return (
              <Button
                key={option.label}
                type="button"
                variant={active ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={active}
                onClick={() => onPatch({ status: option.value })}
              >
                <span className="tnum">
                  {count !== undefined
                    ? `${option.label} (${count})`
                    : option.label}
                </span>
              </Button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="filter-search">Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="filter-search"
            type="search"
            value={filters.q}
            onChange={(event) => onPatch({ q: event.target.value })}
            placeholder="Project or town"
            className="pl-8"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-town">Town</Label>
        {towns === undefined ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <Select
            items={townItems}
            value={filters.town ?? ALL}
            onValueChange={(value) =>
              onPatch({ town: !value || value === ALL ? undefined : value })
            }
          >
            <SelectTrigger id="filter-town" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {townItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-region">Region</Label>
        <Select
          items={[
            { value: ALL, label: "All regions" },
            ...REGIONS.map((r) => ({ value: r, label: r })),
          ]}
          value={filters.region ?? ALL}
          onValueChange={(value) =>
            onPatch({ region: !value || value === ALL ? undefined : value })
          }
        >
          <SelectTrigger id="filter-region" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All regions</SelectItem>
            {REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Classification</legend>
        <div className="flex flex-col gap-2 pt-1">
          {CLASSIFICATIONS.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground"
            >
              <Checkbox
                checked={filters.classifications.includes(c)}
                onCheckedChange={(checked) =>
                  toggleClassification(c, checked === true)
                }
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="filter-flat">Flat type</Label>
        <Select
          items={[
            { value: ALL, label: "Any flat type" },
            ...FLAT_TYPES.map((f) => ({ value: f, label: f })),
          ]}
          value={filters.flat ?? ALL}
          onValueChange={(value) =>
            onPatch({ flat: !value || value === ALL ? undefined : value })
          }
        >
          <SelectTrigger id="filter-flat" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any flat type</SelectItem>
            {FLAT_TYPES.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="filter-price">Max price</Label>
          <span className="tnum text-sm text-muted-foreground">
            {shownPrice >= PRICE_MAX ? "Any" : formatSgd(shownPrice)}
          </span>
        </div>
        <Slider
          id="filter-price"
          aria-label="Maximum price"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={[shownPrice]}
          onValueChange={(value) => setDraftPrice(firstValue(value))}
          onValueCommitted={(value) => {
            const committed = firstValue(value);
            setDraftPrice(null);
            onPatch({
              maxPrice: committed >= PRICE_MAX ? undefined : committed,
            });
          }}
        />
        <div className="tnum flex justify-between text-xs text-muted-foreground">
          <span>{formatSgd(PRICE_MIN)}</span>
          <span>Any</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="filter-wait">Max wait</Label>
          <span className="tnum text-sm text-muted-foreground">
            {shownWait >= WAIT_MAX ? "Any" : `${shownWait} mo`}
          </span>
        </div>
        <Slider
          id="filter-wait"
          aria-label="Maximum wait in months"
          min={WAIT_MIN}
          max={WAIT_MAX}
          step={1}
          value={[shownWait]}
          onValueChange={(value) => setDraftWait(firstValue(value))}
          onValueCommitted={(value) => {
            const committed = firstValue(value);
            setDraftWait(null);
            onPatch({ maxWait: committed >= WAIT_MAX ? undefined : committed });
          }}
        />
        <div className="tnum flex justify-between text-xs text-muted-foreground">
          <span>{WAIT_MIN} mo</span>
          <span>Any</span>
        </div>
      </div>

      {hasActiveFilters(filters) ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="self-start text-muted-foreground"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset filters
        </Button>
      ) : null}
    </div>
  );
}
