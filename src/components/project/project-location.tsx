import Link from "next/link";
import { TrainFront } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SourceBadge } from "@/components/source-badge";

import { ProjectMiniMap } from "./project-mini-map";
import { SavedPlaceDistances } from "./saved-place-distances";
import { factConfidence, townHref, type ProjectDetails } from "./utils";

/**
 * Where it is and how it connects. Coordinates and walk times are our
 * estimates (OneMap-derived), so they carry the estimated badge; the map is
 * a locator, not a site plan.
 */
export function ProjectLocation({ details }: { details: ProjectDetails }) {
  const { project, town, facts } = details;
  const walkConfidence = factConfidence(facts, "mrtWalkingMinutes", "estimated");
  const townName = town?.name;
  const isSbf = project.saleType === "sbf";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <ProjectMiniMap lat={project.lat} lng={project.lng} label={project.name} />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {isSbf ? "Town centroid; the pool spans the town" : "Approximate location"}
          <SourceBadge variant={factConfidence(facts, "lat", "estimated")} size="sm" />
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5 md:p-6">
          <h3 className="text-base font-semibold text-ink">Getting around</h3>
          {project.nearestMrt.length > 0 ? (
            <ul className="space-y-3">
              {project.nearestMrt.map((station, index) => (
                <li key={station} className="flex items-start gap-2.5 text-sm">
                  <TrainFront className="mt-0.5 size-4 shrink-0 text-teal-deep" aria-hidden />
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-ink">{station}</span>
                    {index === 0 && project.mrtWalkingMinutes > 0 ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        ~{project.mrtWalkingMinutes} min walk
                        <SourceBadge variant={walkConfidence} size="sm" />
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isSbf
                ? `Flats in this pool sit across ${townName ?? project.region}; the nearest MRT varies block by block.`
                : "Nearest MRT and walking times are published at launch."}
            </p>
          )}

          <SavedPlaceDistances
            saleType={project.saleType}
            projectLat={project.lat}
            projectLng={project.lng}
          />

          {townName ? (
            <div className="border-t border-border/60 pt-4">
              <p className="mb-2 text-xs text-muted-foreground">
                Part of {townName}, {project.region} region
              </p>
              <Badge
                variant="secondary"
                render={<Link href={townHref(townName)} />}
                className="h-7 px-3 text-sm"
              >
                {isSbf ? "SBF" : "BTO"} in {townName}
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
