import Link from "next/link";

import { AddToCompareButton } from "@/components/add-to-compare-button";
import { LifecycleChip } from "@/components/lifecycle-chip";
import type { ProjectSummary } from "@/components/project-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WatchButton } from "@/components/watch-button";
import { cn } from "@/lib/utils";

import { formatCount } from "./utils";

// Same abbreviation map as ProjectCard so cards never diverge.
const FLAT_ABBR: Record<string, string> = {
  "2-room Flexi": "2R",
  "3-room": "3R",
  "4-room": "4R",
  "5-room": "5R",
  "3Gen": "3Gen",
};

/**
 * An SBF town pool on the town page. ProjectCard would misread the pool's
 * conventions (0 prices = TBC, 0 wait = varies per flat), so balance flats
 * get their own card: exercise, flat mix, unit count, the two actions.
 */
export function SbfPoolCard({
  summary,
  exerciseLabel,
  className,
}: {
  summary: ProjectSummary;
  /** e.g. "February 2026 SBF", resolved from the exercise id by the caller. */
  exerciseLabel?: string;
  className?: string;
}) {
  const { project, flatTypes } = summary;
  const sortedFlats = [...flatTypes].sort((a, b) => b.units - a.units);

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
        aria-label={`View ${project.name}`}
      />
      <CardContent className="relative z-10 pointer-events-none flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink group-hover:text-teal-deep">
              {project.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {exerciseLabel ?? "Sale of Balance Flats"}
            </p>
          </div>
          <LifecycleChip stage="sbf" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {project.classification !== "Unclassified" ? (
            <Badge variant="outline" className="font-medium">
              {project.classification}
            </Badge>
          ) : null}
          {sortedFlats.map((f) => (
            <Badge key={f._id} variant="secondary" className="font-normal">
              {FLAT_ABBR[f.type] ?? f.type}
            </Badge>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="tnum font-medium text-ink">
            {formatCount(project.totalUnits)}
          </span>{" "}
          units · Wait varies by flat
        </p>

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
