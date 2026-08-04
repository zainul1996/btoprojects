import Link from "next/link";
import { ArrowRight, Building2, MapPin, TrainFront, X } from "lucide-react";

import { formatSgd } from "@/components/price";
import { shortExerciseLabel, type ProjectSummary } from "@/components/project-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function startingPrice(summary: ProjectSummary): number | null {
  if (summary.flatTypes.length === 0) return null;
  const value = Math.min(...summary.flatTypes.map((flat) => flat.minPrice));
  return value > 0 ? value : null;
}

export function MapProjectSelection({
  summary,
  onClose,
  className,
}: {
  summary: ProjectSummary;
  onClose: () => void;
  className?: string;
}) {
  const { project, town, exerciseLabel } = summary;
  const isSbf = project.saleType === "sbf";
  const isAnnounced = project.lifecycleStatus === "announced";
  const price = startingPrice(summary);
  const nearestMrt = project.nearestMrt[0];
  const hasMrtEstimate =
    !isSbf && project.mrtWalkingMinutes > 0 && Boolean(nearestMrt);

  return (
    <aside
      className={cn(
        "rounded-xl border border-border bg-surface/98 p-4 shadow-lg shadow-navy/10 backdrop-blur-sm",
        className,
      )}
      aria-label={`Selected project: ${project.name}`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{isSbf ? "SBF" : "BTO"}</Badge>
            {isSbf && exerciseLabel ? (
              <Badge variant="secondary">
                {shortExerciseLabel(exerciseLabel)}
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-2 text-base leading-tight font-semibold text-ink">
            {project.name}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {town?.name ?? project.region}
            </span>
            {price !== null ? (
              <span className="tnum font-medium text-ink">
                From {formatSgd(price)}
              </span>
            ) : isSbf ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" aria-hidden />
                <span className="tnum">{project.totalUnits}</span> balance flats
              </span>
            ) : (
              <span>Prices at launch</span>
            )}
          </p>
          {hasMrtEstimate ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrainFront className="size-3.5" aria-hidden />
              <span>
                Estimated <span className="tnum">{project.mrtWalkingMinutes}</span>
                -minute walk to {nearestMrt}
              </span>
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={`Close ${project.name} details`}
        >
          <X aria-hidden />
        </Button>
      </div>

      {isAnnounced ? (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          Location approximate; exact site at launch
        </p>
      ) : isSbf ? (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          Marker at the town centre; flats are across the town
        </p>
      ) : null}

      <Link
        href={`/projects/${project.slug}`}
        className={cn(
          buttonVariants({ variant: "link", size: "sm" }),
          "mt-2 px-0",
        )}
      >
        {isSbf ? "View SBF town pool" : "View BTO project"}
        <ArrowRight data-icon="inline-end" aria-hidden />
      </Link>
    </aside>
  );
}
