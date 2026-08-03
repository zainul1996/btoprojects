import { Card, CardContent } from "@/components/ui/card";
import { LastVerified } from "@/components/last-verified";
import { Price } from "@/components/price";
import { SourceBadge, type SourceBadgeVariant } from "@/components/source-badge";

import {
  factConfidence,
  formatCount,
  formatIsoDate,
  formatMonthYear,
  latestRetrievedAt,
  type ProjectDetails,
} from "./utils";

function FactRow({
  label,
  value,
  confidence,
}: {
  label: string;
  value: React.ReactNode;
  /** Omitted when the fact itself is unknown (TBC) — no badge on a non-fact. */
  confidence?: SourceBadgeVariant;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-3 text-sm font-medium text-ink">
        {value}
        {confidence ? <SourceBadge variant={confidence} size="sm" /> : null}
      </span>
    </div>
  );
}

/**
 * The exercise-published record for this project: flat mix and prices from
 * HDB's launch materials, with per-row provenance badges (DESIGN.md §4).
 */
export function OfficialFacts({ details }: { details: ProjectDetails }) {
  const { project, facts, flatTypes } = details;
  const sorted = [...flatTypes].sort((a, b) => a.minPrice - b.minPrice);

  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Prices are published at launch — HDB releases the price list with
            the sales exercise. We carry it here the day it&apos;s out.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Flat type
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Units
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Price range
                  </th>
                  <th scope="col" className="py-2.5 text-right font-medium">
                    <span className="sr-only">Source</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sorted.map((flat) => (
                  <tr key={flat._id}>
                    <td className="py-3 pr-4 font-medium text-ink">{flat.type}</td>
                    <td className="tnum py-3 pr-4">{formatCount(flat.units)}</td>
                    <td className="py-3 pr-4">
                      <Price value={flat.minPrice} />
                      <span className="text-muted-foreground"> – </span>
                      <Price value={flat.maxPrice} />
                    </td>
                    <td className="py-3 text-right">
                      <SourceBadge
                        variant={factConfidence(
                          facts,
                          `flatType.${flat.type}.minPrice`,
                          "official",
                        )}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2 divide-y divide-border/60 border-t border-border/60">
          <FactRow
            label="Estimated wait"
            value={
              project.estimatedWaitMonths > 0 ? (
                <span className="tnum">~{project.estimatedWaitMonths} months</span>
              ) : (
                "TBC"
              )
            }
            confidence={
              project.estimatedWaitMonths > 0
                ? factConfidence(facts, "estimatedWaitMonths", "official")
                : undefined
            }
          />
          <FactRow
            label="Estimated completion"
            value={
              project.estimatedCompletion
                ? formatMonthYear(project.estimatedCompletion)
                : "TBC"
            }
            confidence={
              project.estimatedCompletion
                ? factConfidence(facts, "estimatedCompletion", "estimated")
                : undefined
            }
          />
          <FactRow
            label="Total units"
            value={<span className="tnum">{formatCount(project.totalUnits)}</span>}
            confidence={factConfidence(facts, "totalUnits", "official")}
          />
          {project.applicationDeadline ? (
            <FactRow
              label="Application deadline"
              value={formatIsoDate(project.applicationDeadline)}
              confidence={factConfidence(facts, "applicationDeadline", "official")}
            />
          ) : null}
          <FactRow
            label="Classification"
            value={project.classification}
            confidence={factConfidence(facts, "classification", "official")}
          />
        </div>

        <div className="mt-4 flex justify-end border-t border-border/60 pt-4">
          <LastVerified date={latestRetrievedAt(details)} />
        </div>
      </CardContent>
    </Card>
  );
}
