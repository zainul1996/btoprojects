import { Card, CardContent } from "@/components/ui/card";
import { LastVerified } from "@/components/last-verified";
import { SourceBadge } from "@/components/source-badge";

import { FactRow } from "./official-facts";
import {
  factConfidence,
  formatCount,
  formatIsoDate,
  latestRetrievedAt,
  type FactMap,
  type ProjectDetails,
} from "./utils";

type AvailabilityRow = {
  label: string;
  units: number | null;
  applicants: number | null;
};

/** Latest-retrieved value for a fact field; rows arrive unordered. */
function factNumber(facts: FactMap, field: string): number | null {
  const rows = facts[field];
  if (!rows || rows.length === 0) return null;
  let latest = rows[0];
  for (const row of rows) {
    if (row.retrievedAt > latest.retrievedAt) latest = row;
  }
  const value = Number(latest.value);
  return Number.isFinite(value) ? value : null;
}

// BTO flat types in familiar order first; verbatim labels (Community Care
// Apartment, combined rows) after, alphabetical.
const TYPE_ORDER = ["2-room Flexi", "3-room", "4-room", "5-room", "3Gen"];

/**
 * Supply and demand for an SBF town pool, parsed from facts shaped
 * `flatType.<label>.<metric>` so verbatim labels outside the BTO union
 * render too. Prices never appear here: the 0-price convention is TBC,
 * and per-flat prices live on the HDB Flat Portal.
 */
export function SbfAvailability({ details }: { details: ProjectDetails }) {
  const { project, facts } = details;

  const labels = new Set<string>();
  for (const field of Object.keys(facts)) {
    const match = /^flatType\.(.+)\.(units|applicants)$/.exec(field);
    if (match?.[1]) labels.add(match[1]);
  }
  const rows: AvailabilityRow[] = [...labels]
    .sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a);
      const ib = TYPE_ORDER.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? TYPE_ORDER.length : ia) - (ib === -1 ? TYPE_ORDER.length : ib);
      }
      return a.localeCompare(b);
    })
    .map((label) => ({
      label,
      units: factNumber(facts, `flatType.${label}.units`),
      applicants: factNumber(facts, `flatType.${label}.applicants`),
    }));

  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Supply by flat type is published in the exercise&apos;s
            application-rate data on the HDB Flat Portal.
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
                    Applicants
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">
                    Per unit
                  </th>
                  <th scope="col" className="py-2.5 text-right font-medium">
                    <span className="sr-only">Source</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td className="py-3 pr-4 font-medium text-ink">
                      {row.label}
                    </td>
                    <td className="tnum py-3 pr-4">
                      {row.units !== null ? (
                        formatCount(row.units)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="tnum py-3 pr-4">
                      {row.applicants !== null ? (
                        formatCount(row.applicants)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="tnum py-3 pr-4">
                      {row.applicants !== null &&
                      row.units !== null &&
                      row.units > 0 ? (
                        (row.applicants / row.units).toFixed(1)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <SourceBadge
                        variant={factConfidence(
                          facts,
                          `flatType.${row.label}.units`,
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

        <p className="mt-3 text-sm text-muted-foreground">
          Prices were published at launch on the HDB Flat Portal; per-flat
          prices are not listed here.
        </p>

        <div className="mt-2 divide-y divide-border/60 border-t border-border/60">
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
