"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Search } from "lucide-react";

import { formatCount, townHref } from "@/components/project/utils";
import { SourceBadge } from "@/components/source-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALL_FLATS = "__all__";
const INITIAL_TOWN_COUNT = 8;

type SbfBoardRow = {
  flatType: string;
  units: number;
  applicants: number | null;
};

export type SbfTownGroup = {
  town: string;
  region: string;
  projectSlug: string;
  classification: string;
  rows: SbfBoardRow[];
};

type SbfSort = "town" | "units" | "ratio";

type SbfBoardProps = {
  towns: SbfTownGroup[];
  initialFilters?: {
    town?: string;
    flat?: string;
    sort?: string;
  };
};

function replaceBoardUrl(filters: {
  town: string;
  flat: string;
  sort: SbfSort;
}) {
  const params = new URLSearchParams(window.location.search);
  if (filters.town.trim()) params.set("town", filters.town.trim());
  else params.delete("town");
  if (filters.flat !== ALL_FLATS) params.set("flat", filters.flat);
  else params.delete("flat");
  if (filters.sort !== "town") params.set("sort", filters.sort);
  else params.delete("sort");

  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
}

function ratioOf(rows: SbfBoardRow[]): number | null {
  if (rows.some((row) => row.applicants === null || row.units <= 0)) {
    return null;
  }
  let units = 0;
  let applicants = 0;
  for (const row of rows) {
    units += row.units;
    applicants += row.applicants ?? 0;
  }
  return units > 0 ? applicants / units : null;
}

export function SbfBoard({ towns, initialFilters }: SbfBoardProps) {
  const flatTypes = useMemo(
    () =>
      [...new Set(towns.flatMap((town) => town.rows.map((row) => row.flatType)))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [towns],
  );
  const initialFlat =
    initialFilters?.flat && flatTypes.includes(initialFilters.flat)
      ? initialFilters.flat
      : ALL_FLATS;
  const initialSort: SbfSort =
    initialFilters?.sort === "units" || initialFilters?.sort === "ratio"
      ? initialFilters.sort
      : "town";

  const [townQuery, setTownQuery] = useState(initialFilters?.town ?? "");
  const [flatType, setFlatType] = useState(initialFlat);
  const [sort, setSort] = useState<SbfSort>(initialSort);
  const [shownCount, setShownCount] = useState(INITIAL_TOWN_COUNT);

  const visible = useMemo(() => {
    const query = townQuery.trim().toLocaleLowerCase("en-SG");
    const matches = towns.flatMap((town) => {
      if (query && !town.town.toLocaleLowerCase("en-SG").includes(query)) {
        return [];
      }
      const rows =
        flatType === ALL_FLATS
          ? town.rows
          : town.rows.filter((row) => row.flatType === flatType);
      if (rows.length === 0) return [];
      const units = rows.reduce((sum, row) => sum + row.units, 0);
      return [{ ...town, rows, units, ratio: ratioOf(rows) }];
    });

    matches.sort((a, b) => {
      if (sort === "units") return b.units - a.units;
      if (sort === "ratio") return (a.ratio ?? Infinity) - (b.ratio ?? Infinity);
      return a.town.localeCompare(b.town);
    });
    return matches;
  }, [flatType, sort, townQuery, towns]);

  const shown = visible.slice(0, shownCount);
  const totalUnits = visible.reduce((sum, town) => sum + town.units, 0);
  const hasFilters =
    townQuery.trim().length > 0 || flatType !== ALL_FLATS || sort !== "town";

  const updateTown = (value: string) => {
    setTownQuery(value);
    setShownCount(INITIAL_TOWN_COUNT);
    replaceBoardUrl({ town: value, flat: flatType, sort });
  };

  const updateFlat = (value: string | null) => {
    const next = value ?? ALL_FLATS;
    setFlatType(next);
    setShownCount(INITIAL_TOWN_COUNT);
    replaceBoardUrl({ town: townQuery, flat: next, sort });
  };

  const updateSort = (value: string | null) => {
    const next: SbfSort =
      value === "units" || value === "ratio" ? value : "town";
    setSort(next);
    setShownCount(INITIAL_TOWN_COUNT);
    replaceBoardUrl({ town: townQuery, flat: flatType, sort: next });
  };

  const reset = () => {
    setTownQuery("");
    setFlatType(ALL_FLATS);
    setSort("town");
    setShownCount(INITIAL_TOWN_COUNT);
    replaceBoardUrl({ town: "", flat: ALL_FLATS, sort: "town" });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)_minmax(13rem,0.7fr)] md:p-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sbf-town-search">Town</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="sbf-town-search"
              type="search"
              value={townQuery}
              onChange={(event) => updateTown(event.target.value)}
              placeholder="Search towns"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sbf-flat-filter">Flat type</Label>
          <Select
            items={[
              { value: ALL_FLATS, label: "All flat types" },
              ...flatTypes.map((flat) => ({ value: flat, label: flat })),
            ]}
            value={flatType}
            onValueChange={updateFlat}
          >
            <SelectTrigger id="sbf-flat-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_FLATS}>All flat types</SelectItem>
                {flatTypes.map((flat) => (
                  <SelectItem key={flat} value={flat}>
                    {flat}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sbf-sort">Sort</Label>
          <Select
            items={[
              { value: "town", label: "Town: A to Z" },
              { value: "units", label: "Most flats" },
              { value: "ratio", label: "Lowest applicants per flat" },
            ]}
            value={sort}
            onValueChange={updateSort}
          >
            <SelectTrigger id="sbf-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="town">Town: A to Z</SelectItem>
                <SelectItem value="units">Most flats</SelectItem>
                <SelectItem value="ratio">Lowest applicants per flat</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="tnum font-medium text-ink" aria-live="polite">
          {visible.length} town{visible.length === 1 ? "" : "s"} ·{" "}
          {formatCount(totalUnits)} flat{totalUnits === 1 ? "" : "s"}
        </span>
        <SourceBadge variant="official" size="sm" />
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            Reset
          </Button>
        ) : null}
      </div>

      {shown.length > 0 ? (
        <div className="grid gap-4">
          {shown.map((town) => (
            <Card key={town.town} className="gap-0 py-0">
              <CardContent className="p-5 md:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-base font-semibold text-ink">
                      <Link href={townHref(town.town)} className="hover:text-teal-deep">
                        {town.town}
                      </Link>
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {town.region}
                    </span>
                    {town.classification !== "Unclassified" ? (
                      <Badge variant="outline" className="font-normal">
                        {town.classification}
                      </Badge>
                    ) : null}
                  </div>
                  <Link
                    href={`/projects/${town.projectSlug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    View pool
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>

                <div className="mt-4 divide-y divide-border/60 sm:hidden">
                  {town.rows.map((row) => {
                    const applicantsPerFlat =
                      row.applicants !== null && row.units > 0
                        ? (row.applicants / row.units).toFixed(1)
                        : null;
                    return (
                      <div key={row.flatType} className="py-3 first:pt-0 last:pb-0">
                        <p className="font-medium text-ink">{row.flatType}</p>
                        <dl className="mt-2 grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <dt className="text-muted-foreground">Units</dt>
                            <dd className="tnum mt-0.5 text-sm text-ink">
                              {formatCount(row.units)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Applicants</dt>
                            <dd className="tnum mt-0.5 text-sm text-ink">
                              {row.applicants !== null
                                ? formatCount(row.applicants)
                                : "Not published"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Per flat</dt>
                            <dd className="tnum mt-0.5 text-sm text-ink">
                              {applicantsPerFlat ?? "Not published"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                        <TableHead className="px-0 py-2.5 pr-4 font-medium">
                          Flat type
                        </TableHead>
                        <TableHead className="px-0 py-2.5 pr-4 font-medium">
                          Units
                        </TableHead>
                        <TableHead className="px-0 py-2.5 pr-4 font-medium">
                          Applicants
                        </TableHead>
                        <TableHead className="px-0 py-2.5 font-medium">
                          Applicants / flat
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {town.rows.map((row) => (
                        <TableRow key={row.flatType} className="hover:bg-transparent">
                          <TableCell className="px-0 py-3 pr-4 font-medium text-ink">
                            {row.flatType}
                          </TableCell>
                          <TableCell className="tnum px-0 py-3 pr-4">
                            {formatCount(row.units)}
                          </TableCell>
                          <TableCell className="tnum px-0 py-3 pr-4">
                            {row.applicants !== null ? (
                              formatCount(row.applicants)
                            ) : (
                              <span className="text-muted-foreground">
                                Not published
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="tnum px-0 py-3">
                            {row.applicants !== null && row.units > 0 ? (
                              (row.applicants / row.units).toFixed(1)
                            ) : (
                              <span className="text-muted-foreground">
                                Not published
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          headingLevel={3}
          title="No towns match these filters"
          hint="Try another town or flat type."
          action={
            hasFilters ? (
              <Button type="button" variant="outline" onClick={reset}>
                Clear filters
              </Button>
            ) : null
          }
        />
      )}

      {shownCount < visible.length ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setShownCount((count) => count + INITIAL_TOWN_COUNT)}
        >
          Show {Math.min(INITIAL_TOWN_COUNT, visible.length - shownCount)} more
          towns
        </Button>
      ) : null}
    </div>
  );
}
