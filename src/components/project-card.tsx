import Link from "next/link";
import { Clock3, TrainFront } from "lucide-react";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../convex/_generated/api";
import { AddToCompareButton } from "@/components/add-to-compare-button";
import { LifecycleChip } from "@/components/lifecycle-chip";
import { Price } from "@/components/price";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WatchButton } from "@/components/watch-button";
import { cn } from "@/lib/utils";

export type ProjectSummary = FunctionReturnType<typeof api.projects.list>[number];

const FLAT_ABBR: Record<string, string> = {
  "2-room Flexi": "2R",
  "3-room": "3R",
  "4-room": "4R",
  "5-room": "5R",
  "3Gen": "3Gen",
};

function flatAbbr(type: string): string {
  return FLAT_ABBR[type] ?? type;
}

const MONTH_ABBR: Record<string, string> = {
  January: "Jan",
  February: "Feb",
  March: "Mar",
  April: "Apr",
  May: "May",
  June: "Jun",
  July: "Jul",
  August: "Aug",
  September: "Sep",
  October: "Oct",
  November: "Nov",
  December: "Dec",
};

/** "February 2026 SBF" -> "Feb 2026"; unexpected shapes pass through. */
export function shortExerciseLabel(label: string): string {
  const [month, year] = label.split(" ");
  if (!month || !year) return label;
  return `${MONTH_ABBR[month] ?? month} ${year}`;
}

/**
 * The project's face everywhere — explorer lists, town/exercise pages.
 * One idea per card (DESIGN.md): what it is, where, from how much, how long
 * the wait, and the two actions (compare, watch).
 */
export function ProjectCard({
  summary,
  className,
}: {
  summary: ProjectSummary;
  className?: string;
}) {
  const { project, town, flatTypes, exerciseLabel } = summary;
  const isAnnounced = project.lifecycleStatus === "announced";
  const isSbf = project.saleType === "sbf";
  const fromPrice = flatTypes.length
    ? Math.min(...flatTypes.map((f) => f.minPrice))
    : null;
  // 0 means "price TBC" (announced projects, SBF pools) — never show $0.
  const knownPrice = fromPrice !== null && fromPrice > 0 ? fromPrice : null;
  const sortedFlats = [...flatTypes].sort(
    (a, b) => a.minPrice - b.minPrice,
  );

  return (
    <Card
      className={cn(
        "group relative gap-0 py-0 transition-shadow hover:shadow-md hover:shadow-navy/5",
        className,
      )}
    >
      <Link
        href={`/projects/${project.slug}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={
          isSbf ? `View ${project.name} SBF town pool` : `View ${project.name}`
        }
      />
      <CardContent className="relative z-10 pointer-events-none flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink group-hover:text-teal-deep">
              {project.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {town?.name ?? project.region} · {project.region}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge
              variant="outline"
              className={
                isSbf
                  ? "border-teal-deep/25 bg-teal-subtle font-medium text-teal-deeper"
                  : "font-medium text-muted-foreground"
              }
            >
              {isSbf ? "SBF" : "BTO"}
            </Badge>
            {/* SBF is a sale format, not a project lifecycle stage. Its
                exercise badge identifies it without a duplicate "SBF" chip. */}
            {!isSbf ? <LifecycleChip stage={project.lifecycleStatus} /> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isSbf && exerciseLabel ? (
            <Badge
              variant="outline"
              className="font-normal text-muted-foreground"
            >
              {shortExerciseLabel(exerciseLabel)}
            </Badge>
          ) : null}
          {/* "Unclassified" is noise on a pool (rules vary per flat) — skip. */}
          {project.classification !== "Unclassified" ? (
            <Badge variant="outline" className="font-medium">
              {project.classification}
            </Badge>
          ) : null}
          {sortedFlats.map((f) => (
            <Badge key={f._id} variant="secondary" className="font-normal">
              {flatAbbr(f.type)}
            </Badge>
          ))}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            {knownPrice !== null ? (
              <p className="text-lg font-semibold text-ink">
                <span className="text-sm font-normal text-muted-foreground">From </span>
                <Price value={knownPrice} />
              </p>
            ) : isSbf ? (
              <p className="text-sm font-medium text-muted-foreground">
                Price data unavailable
              </p>
            ) : isAnnounced ? (
              <p className="text-sm font-medium text-muted-foreground">
                Prices at launch
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" aria-hidden />
                {isSbf
                  ? "Wait varies by flat"
                  : project.estimatedWaitMonths > 0
                    ? `~${project.estimatedWaitMonths} mo wait`
                    : "Timeline TBC"}
              </span>
              {project.nearestMrt.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <TrainFront className="size-3.5" aria-hidden />
                  {project.mrtWalkingMinutes > 0
                    ? `~${project.mrtWalkingMinutes} min to ${project.nearestMrt[0]}`
                    : `Near ${project.nearestMrt[0]}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* mt-auto pins actions to the card bottom, so a two-line badge row
            on one card never shifts the buttons relative to its neighbours. */}
        <div className="pointer-events-auto mt-auto flex items-center justify-end gap-1 border-t border-border/60 pt-3">
          <WatchButton
            targetType="project"
            targetId={project.slug}
            label={project.name}
          />
          <AddToCompareButton slug={project.slug} />
        </div>
      </CardContent>
    </Card>
  );
}
