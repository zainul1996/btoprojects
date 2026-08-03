"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { ArrowLeftRight, MoveRight, X } from "lucide-react";

import { CLASSIFICATION_POLICY } from "@/components/compare/policy";
import { useCompare } from "@/components/compare-tray";
import { EmptyState } from "@/components/empty-state";
import { LifecycleChip } from "@/components/lifecycle-chip";
import { Price, formatSgd } from "@/components/price";
import type { ProjectSummary } from "@/components/project-card";
import { formatMonthYear } from "@/components/project/utils";
import { SourceBadge } from "@/components/source-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { COMPARE_MAX, compareUrl, prettifySlug } from "@/lib/compare";
import { cn } from "@/lib/utils";

/** "S$420k" / "S$415.5k" — compact form for per-flat-type lines. */
function formatSgdK(value: number): string {
  const k = Math.round((value / 1000) * 10) / 10;
  return `S$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

function formatCount(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fromPriceOf(summary: ProjectSummary): number | null {
  if (!summary.flatTypes.length) return null;
  const min = Math.min(...summary.flatTypes.map((f) => f.minPrice));
  // 0 = "TBC" (SBF pools; prices were on the portal, not in our data).
  return min > 0 ? min : null;
}

/** Honest cell for figures that exist but are not in our data (SBF prices). */
function Tbc() {
  return <span className="text-muted-foreground">Not in our data</span>;
}

function mrtWalkOf(summary: ProjectSummary): number | null {
  // 0 minutes means "unknown" (announced projects), not a zero-minute walk.
  return summary.project.nearestMrt.length &&
    summary.project.mrtWalkingMinutes > 0
    ? summary.project.mrtWalkingMinutes
    : null;
}

/** Longest scale we render bars against — beyond this the bar is full. */
const WAIT_BAR_MAX_MONTHS = 60;

type AttributeRow = {
  key: string;
  label: ReactNode;
  /** Lower-is-better metric for best-cell highlighting; null excludes a cell. */
  metric?: (summary: ProjectSummary) => number | null;
  cell: (summary: ProjectSummary) => ReactNode;
};

type RowGroup = { key: string; label: string; rows: AttributeRow[] };

const GROUPS: RowGroup[] = [
  {
    key: "price",
    label: "Price",
    rows: [
      {
        key: "from",
        label: "From price",
        metric: fromPriceOf,
        cell: (s) => {
          if (s.project.saleType === "sbf") return <Tbc />;
          const from = fromPriceOf(s);
          return from === null ? (
            <MutedDash />
          ) : (
            <Price value={from} className="text-lg font-semibold text-ink" />
          );
        },
      },
      {
        key: "range",
        label: "Price range",
        cell: (s) =>
          s.project.saleType === "sbf" ? (
            <Tbc />
          ) : s.flatTypes.length === 0 ? (
            <MutedDash />
          ) : (
            <span className="tnum">
              {formatSgd(Math.min(...s.flatTypes.map((f) => f.minPrice)))}–
              {formatSgd(Math.max(...s.flatTypes.map((f) => f.maxPrice)))}
            </span>
          ),
      },
      {
        key: "per-type",
        label: "By flat type",
        cell: (s) =>
          s.project.saleType === "sbf" ? (
            <Tbc />
          ) : s.flatTypes.length === 0 ? (
            <MutedDash />
          ) : (
            <div className="flex flex-col gap-1">
              {[...s.flatTypes]
                .sort((a, b) => a.minPrice - b.minPrice)
                .map((f) => (
                  <span key={f._id} className="tnum whitespace-nowrap">
                    {f.type} {formatSgdK(f.minPrice)}–{formatSgdK(f.maxPrice)}
                  </span>
                ))}
            </div>
          ),
      },
    ],
  },
  {
    key: "wait",
    label: "Wait",
    rows: [
      {
        key: "wait",
        label: "Estimated wait",
        // SBF pools mix individual flats, so their waits are not directly
        // comparable even if a legacy aggregate value exists.
        metric: (s) =>
          s.project.saleType === "sbf"
            ? null
            : s.project.estimatedWaitMonths || null,
        cell: (s) => {
          if (s.project.saleType === "sbf") {
            return <span className="text-muted-foreground">Varies by flat</span>;
          }
          const months = s.project.estimatedWaitMonths;
          if (months <= 0) {
            return <span className="text-muted-foreground">TBC</span>;
          }
          const pct = Math.min(
            100,
            Math.round((months / WAIT_BAR_MAX_MONTHS) * 100),
          );
          return (
            <div className="flex flex-col gap-1.5">
              <span className="tnum font-medium text-ink">~{months} mo</span>
              <div
                className="h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`About ${months} months wait`}
              >
                <div
                  className="h-full rounded-full bg-teal"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        key: "completion",
        label: "Est. completion",
        cell: (s) =>
          s.project.estimatedCompletion ? (
            <span className="tnum whitespace-nowrap">
              {formatMonthYear(s.project.estimatedCompletion)}
            </span>
          ) : (
            <span className="text-muted-foreground">TBC</span>
          ),
      },
      {
        key: "units",
        label: "Total units",
        cell: (s) => (
          <span className="tnum">{formatCount(s.project.totalUnits)}</span>
        ),
      },
    ],
  },
  {
    key: "location",
    label: "Location",
    rows: [
      {
        key: "mrt",
        label: "Nearest MRT",
        metric: mrtWalkOf,
        cell: (s) =>
          s.project.nearestMrt.length === 0 ? (
            <MutedDash />
          ) : s.project.mrtWalkingMinutes > 0 ? (
            <span>
              <span className="tnum">~{s.project.mrtWalkingMinutes}</span> min
              walk to {s.project.nearestMrt[0]}
            </span>
          ) : (
            <span>Near {s.project.nearestMrt[0]}</span>
          ),
      },
      {
        key: "region",
        label: "Region",
        cell: (s) => s.project.region,
      },
      {
        key: "town",
        label: "Town",
        cell: (s) => s.town?.name ?? <MutedDash />,
      },
    ],
  },
  {
    key: "restrictions",
    label: "Restrictions",
    rows: [
      {
        key: "policy",
        label: (
          <span className="flex flex-col items-start gap-1.5">
            <span>Classification rules</span>
            <SourceBadge size="sm" />
          </span>
        ),
        cell: (s) => (
          <span className="whitespace-normal">
            {CLASSIFICATION_POLICY[s.project.classification]}
          </span>
        ),
      },
    ],
  },
];

function MutedDash() {
  return <span className="text-muted-foreground">—</span>;
}

/**
 * The signature row: what each project makes you give up, derived from the
 * set being compared. A trade-off only exists when another column beats it.
 */
function computeGiveUps(projects: ProjectSummary[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const s of projects) result.set(s.project.slug, []);
  if (projects.length < 2) return result;

  const metrics: {
    value: (s: ProjectSummary) => number | null;
    describeDifference: (difference: number) => string;
  }[] = [
    {
      value: (s) =>
        s.project.saleType === "sbf"
          ? null
          : s.project.estimatedWaitMonths || null,
      describeDifference: (difference) =>
        `${difference} ${difference === 1 ? "month" : "months"} longer wait`,
    },
    {
      value: fromPriceOf,
      describeDifference: (difference) =>
        `${formatSgd(difference)} higher entry price`,
    },
    {
      value: mrtWalkOf,
      describeDifference: (difference) =>
        `${difference} ${difference === 1 ? "minute" : "minutes"} farther from the MRT`,
    },
  ];

  for (const { value, describeDifference } of metrics) {
    const values = projects.map(value).filter((v): v is number => v !== null);
    if (values.length < 2) continue;
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max === min) continue;
    for (const s of projects) {
      if (value(s) === max) {
        result
          .get(s.project.slug)
          ?.push(describeDifference(max - min));
      }
    }
  }
  return result;
}

function CompareStartSteps() {
  return (
    <ol className="grid divide-y divide-border border-y border-border text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      <li className="py-3 sm:px-4 sm:first:pl-0">
        <span className="font-medium text-ink">1. Add an option</span>
        <p className="mt-1 text-muted-foreground">
          Use Compare on a project card or project page.
        </p>
      </li>
      <li className="py-3 sm:px-4 sm:last:pr-0">
        <span className="font-medium text-ink">2. Add another</span>
        <p className="mt-1 text-muted-foreground">
          We will line up price, wait, location and restrictions.
        </p>
      </li>
    </ol>
  );
}

/** Best value per comparable row; ties share the highlight, all-equal shows none. */
function bestByRow(
  projects: ProjectSummary[],
): Map<string, number> {
  const best = new Map<string, number>();
  if (projects.length < 2) return best;
  for (const group of GROUPS) {
    for (const row of group.rows) {
      if (!row.metric) continue;
      const values = projects
        .map(row.metric)
        .filter((v): v is number => v !== null);
      if (values.length < 2) continue;
      const min = Math.min(...values);
      if (min < Math.max(...values)) best.set(row.key, min);
    }
  }
  return best;
}

export function CompareWorkspace({
  slugs,
  summaries,
}: {
  slugs: string[];
  /** Server-fetched summaries so shared links render real content on first paint. */
  summaries: ProjectSummary[];
}) {
  const router = useRouter();
  const { remove: removeFromTray } = useCompare();

  const requested = slugs.slice(0, COMPARE_MAX);
  const overflowCount = slugs.length - requested.length;

  const found: ProjectSummary[] = [];
  const unknown: string[] = [];
  const bySlug = new Map(summaries.map((s) => [s.project.slug, s]));
  for (const slug of requested) {
    const hit = bySlug.get(slug);
    if (hit) found.push(hit);
    else unknown.push(slug);
  }

  const removeSlug = (slug: string) => {
    removeFromTray(slug);
    router.replace(compareUrl(slugs.filter((s) => s !== slug)));
  };

  if (requested.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="Build a side-by-side comparison"
        hint="Choose two BTO projects or SBF town pools. Your shortlist stays in this browser."
        details={<CompareStartSteps />}
        action={
          <Link href="/explore" className={buttonVariants()}>
            Find projects
          </Link>
        }
      />
    );
  }

  return (
    <div>
      {overflowCount > 0 && (
        <p className="mb-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Compare supports up to {COMPARE_MAX} projects. Showing the first{" "}
          {COMPARE_MAX} from your link.
        </p>
      )}

      {unknown.length > 0 && (
        <div className="mb-4 space-y-2 rounded-lg border border-dashed px-4 py-3">
          {unknown.map((slug) => (
            <div
              key={slug}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <p className="text-muted-foreground">
                We couldn&apos;t find{" "}
                <span className="font-medium text-ink">
                  {prettifySlug(slug)}
                </span>{" "}
                . It may have been renamed or removed.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSlug(slug)}
              >
                <X className="size-3.5" aria-hidden />
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {found.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No matching projects in this link"
          hint="The saved project names may have changed. Start a fresh comparison from the project list."
          details={<CompareStartSteps />}
          action={
            <Link href="/explore" className={buttonVariants()}>
              Find projects
            </Link>
          }
        />
      ) : (
        <>
          {found.length === 1 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-teal-subtle/50 px-4 py-3 text-sm text-teal-deeper">
              <p>Add one more option to see meaningful differences.</p>
              <Link
                href="/explore"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Find projects
              </Link>
            </div>
          )}
          {found.some((summary) => summary.project.saleType === "sbf") && (
            <p
              role="note"
              className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
            >
              SBF prices vary by individual flat and are not held in our data,
              and waits also vary by flat. Price and wait are therefore not
              directly comparable with BTO and are excluded from highlights
              and trade-off analysis.
            </p>
          )}
          <CompareTable projects={found} onRemove={removeSlug} />
        </>
      )}
    </div>
  );
}

function CompareTable({
  projects,
  onRemove,
}: {
  projects: ProjectSummary[];
  onRemove: (slug: string) => void;
}) {
  const best = bestByRow(projects);
  const giveUps = computeGiveUps(projects);
  const hasBto = projects.some((summary) => summary.project.saleType !== "sbf");
  const hasSbf = projects.some((summary) => summary.project.saleType === "sbf");
  const comparedKinds =
    hasBto && hasSbf
      ? "BTO projects and SBF town pools"
      : hasSbf
        ? "SBF town pools"
        : "BTO projects";

  const firstColClass =
    "sticky left-0 z-10 w-32 min-w-32 bg-surface border-r border-border md:w-44 md:min-w-44";
  const cellClass = "border-b border-border/70 px-4 py-3.5 align-top";

  return (
    <div className="flex flex-col gap-2">
      {projects.length > 1 ? (
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground md:hidden">
          Swipe the project columns to compare
          <MoveRight className="size-4" aria-hidden />
        </p>
      ) : null}
      <div className="relative">
        {projects.length > 1 ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-40 w-7 bg-linear-to-l from-surface to-transparent md:hidden"
            aria-hidden
          />
        ) : null}
        <div
          className="snap-x snap-proximity overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-surface focus-visible:ring-2 focus-visible:ring-ring md:max-h-[calc(100svh-7rem)] md:overflow-auto md:overscroll-contain"
          role="region"
          aria-label="Project comparison table. Scroll horizontally for more projects."
          tabIndex={0}
        >
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Side-by-side comparison of {projects.length} {comparedKinds}
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(
                firstColClass,
                "sticky top-0 z-30 border-b px-4 py-4 text-left align-bottom text-xs font-medium text-muted-foreground",
              )}
            >
              Attribute
            </th>
            {projects.map(({ project, town }) => (
              <th
                key={project.slug}
                scope="col"
                className="sticky top-0 z-20 min-w-56 snap-start border-b border-border bg-surface px-4 py-4 text-left align-top font-normal"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1.5">
                    <Link
                      href={`/projects/${project.slug}`}
                      className="block text-base font-semibold text-ink hover:text-teal-deep"
                    >
                      {project.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {town?.name ?? project.region} · {project.region}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={
                          project.saleType === "sbf"
                            ? "border-teal-deep/25 bg-teal-subtle font-medium text-teal-deeper"
                            : "font-medium text-muted-foreground"
                        }
                      >
                        {project.saleType === "sbf" ? "SBF" : "BTO"}
                      </Badge>
                      {project.saleType !== "sbf" ? (
                        <LifecycleChip stage={project.lifecycleStatus} />
                      ) : null}
                      {project.classification !== "Unclassified" ? (
                        <Badge variant="outline" className="font-medium">
                          {project.classification}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${project.name} from comparison`}
                    onClick={() => onRemove(project.slug)}
                  >
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => (
            <Fragment key={group.key}>
              <tr>
                <td
                  colSpan={projects.length + 1}
                  className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {group.label}
                </td>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className={cn(
                      firstColClass,
                      "px-4 py-3.5 text-left align-top text-sm font-medium text-ink",
                    )}
                  >
                    {row.label}
                  </th>
                  {projects.map((s) => {
                    const value = row.metric?.(s) ?? null;
                    const isBest =
                      value !== null && best.get(row.key) === value;
                    return (
                      <td
                        key={s.project.slug}
                        className={cn(
                          cellClass,
                          "min-w-56",
                          isBest && "bg-teal-subtle/60",
                        )}
                      >
                        <div className="flex flex-col gap-2">
                          {isBest ? (
                            <Badge variant="secondary" className="font-normal">
                              Best here
                            </Badge>
                          ) : null}
                          {row.cell(s)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}

          <tr>
            <td
              colSpan={projects.length + 1}
              className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Trade-offs
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              className={cn(
                firstColClass,
                "border-b-0 px-4 py-3.5 text-left align-top text-sm font-medium text-ink",
              )}
            >
              <span className="flex flex-col items-start gap-1.5">
                <span>What you give up</span>
                <SourceBadge variant="analysis" size="sm" />
              </span>
            </th>
            {projects.map((s) => {
              const items = giveUps.get(s.project.slug) ?? [];
              return (
                <td
                  key={s.project.slug}
                  className={cn(cellClass, "min-w-56 border-b-0")}
                >
                  {items.length ? (
                    <span>{items.join(" · ")}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      No measured disadvantage in the comparable data available
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
