import { Card, CardContent } from "@/components/ui/card";
import { LastVerified } from "@/components/last-verified";
import { Price } from "@/components/price";
import { SourceBadge, type SourceBadgeVariant } from "@/components/source-badge";

import {
  factConfidence,
  formatCount,
  formatIsoDate,
  formatMonthYear,
  formatTimestamp,
  latestRetrievedAt,
  type ProjectDetails,
} from "./utils";

type ProjectFact = ProjectDetails["facts"][string][number];
type ProjectSource = ProjectDetails["sources"][number];

interface DemandRow {
  flatType: string;
  applicants: number;
  units: number | null;
  applicantFact: ProjectFact;
  unitFact: ProjectFact | null;
}

function latestOfficialFact(rows: ProjectFact[] | undefined): ProjectFact | null {
  return (
    rows
      ?.filter((fact) => fact.confidence === "official")
      .reduce<ProjectFact | null>(
        (latest, fact) =>
          latest === null || fact.retrievedAt > latest.retrievedAt
            ? fact
            : latest,
        null,
      ) ?? null
  );
}

function demandRows(details: ProjectDetails): DemandRow[] {
  const unitsByType = new Map<string, number>(
    details.flatTypes.map((flat) => [flat.type, flat.units]),
  );
  const rows: DemandRow[] = [];

  for (const [field, facts] of Object.entries(details.facts)) {
    const match = /^flatType\.(.+)\.applicants$/.exec(field);
    if (!match) continue;
    const flatType = match[1];
    if (!flatType) continue;
    const fact = latestOfficialFact(facts);
    if (!fact) continue;
    const applicants = Number(fact.value);
    if (!Number.isFinite(applicants) || applicants < 0) continue;

    const unitsFact = latestOfficialFact(
      details.facts[`flatType.${flatType}.units`],
    );
    const factUnits = unitsFact ? Number(unitsFact.value) : null;
    const fallbackUnits = unitsByType.get(flatType) ?? null;
    const knownUnits =
      factUnits !== null && Number.isFinite(factUnits) && factUnits > 0
        ? factUnits
        : fallbackUnits;

    rows.push({
      flatType,
      applicants,
      units:
        knownUnits !== null &&
        knownUnits !== undefined &&
        Number.isFinite(knownUnits) &&
        knownUnits > 0
          ? knownUnits
          : null,
      applicantFact: fact,
      unitFact:
        factUnits !== null && Number.isFinite(factUnits) && factUnits > 0
          ? unitsFact
          : null,
    });
  }

  return rows.sort((a, b) => a.flatType.localeCompare(b.flatType, "en-SG"));
}

function formatDemandRatio(applicants: number, units: number): string {
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(applicants / units);
}

function DemandProvenance({
  row,
  sourcesById,
}: {
  row: DemandRow;
  sourcesById: ReadonlyMap<string, ProjectSource>;
}) {
  const applicantSource = row.applicantFact.sourceId
    ? sourcesById.get(row.applicantFact.sourceId)
    : undefined;
  const unitSource = row.unitFact?.sourceId
    ? sourcesById.get(row.unitFact.sourceId)
    : undefined;
  const sharedSource =
    applicantSource &&
    unitSource &&
    applicantSource._id === unitSource._id
      ? applicantSource
      : null;

  const link = (source: ProjectSource, label: string) => (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="text-teal-deep underline-offset-2 hover:underline"
      title={source.publisher}
    >
      {label}
    </a>
  );

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <SourceBadge variant="official" size="sm" />
      {sharedSource ? (
        <p>
          {link(sharedSource, "Applicants & units: HDB source")} · retrieved{" "}
          {formatTimestamp(
            Math.max(
              row.applicantFact.retrievedAt,
              row.unitFact?.retrievedAt ?? 0,
            ),
          )}
        </p>
      ) : (
        <>
          <p>
            Applicants:{" "}
            {applicantSource
              ? link(applicantSource, "HDB source")
              : "official fact"}{" "}
            · retrieved {formatTimestamp(row.applicantFact.retrievedAt)}
          </p>
          <p>
            Units:{" "}
            {unitSource
              ? link(unitSource, "HDB source")
              : "published project flat mix"}
            {row.unitFact
              ? ` · retrieved ${formatTimestamp(row.unitFact.retrievedAt)}`
              : ""}
          </p>
        </>
      )}
    </div>
  );
}

export function FactRow({
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
  const demand = demandRows(details);
  const demandRetrievedAt = demand.reduce(
    (latest, row) =>
      Math.max(
        latest,
        row.applicantFact.retrievedAt,
        row.unitFact?.retrievedAt ?? 0,
      ),
    0,
  );
  const sourcesById = new Map<string, ProjectSource>(
    details.sources.map((source) => [source._id, source]),
  );

  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Prices are published at launch. HDB releases the price list with
            the sales exercise, and we carry it here the day it&apos;s out.
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

        {demand.length > 0 ? (
          <details className="group mt-5 rounded-lg border border-border/70 bg-muted/25">
            <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-semibold text-ink outline-none marker:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring">
              Latest published demand
              <span className="ml-2 font-normal text-muted-foreground">
                {demand.length} flat {demand.length === 1 ? "type" : "types"}
              </span>
            </summary>
            <div className="border-t border-border/60 px-4 pb-4 pt-3">
              <p className="mb-3 text-xs text-muted-foreground">
                {details.exercise?.label ?? "HDB sales exercise"}
                {demandRetrievedAt > 0
                  ? ` · Retrieved ${formatTimestamp(demandRetrievedAt)}`
                  : ""}
              </p>

              <ul className="space-y-3 md:hidden">
                {demand.map((row) => (
                  <li
                    key={row.flatType}
                    className="rounded-lg border border-border/60 bg-surface p-3"
                  >
                    <h4 className="text-sm font-semibold text-ink">
                      {row.flatType}
                    </h4>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="col-span-2 rounded-md bg-teal-subtle/50 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">
                          Applicants / unit
                        </dt>
                        <dd className="tnum mt-0.5 text-lg font-semibold text-ink">
                          {row.units === null
                            ? "—"
                            : formatDemandRatio(row.applicants, row.units)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Applicants
                        </dt>
                        <dd className="tnum font-medium">
                          {formatCount(row.applicants)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Units</dt>
                        <dd className="tnum font-medium">
                          {row.units === null ? "—" : formatCount(row.units)}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 border-t border-border/60 pt-2">
                      <DemandProvenance
                        row={row}
                        sourcesById={sourcesById}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Latest official HDB applicant counts and applicants per unit
                  </caption>
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Flat type
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-right font-medium"
                      >
                        Applicants / unit
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-right font-medium"
                      >
                        Applicants
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-right font-medium"
                      >
                        Units
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Provenance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {demand.map((row) => (
                      <tr key={row.flatType}>
                        <th
                          scope="row"
                          className="whitespace-nowrap py-3 pr-4 text-left font-medium text-ink"
                        >
                          {row.flatType}
                        </th>
                        <td className="tnum py-3 pr-4 text-right font-semibold">
                          {row.units === null
                            ? "—"
                            : formatDemandRatio(row.applicants, row.units)}
                        </td>
                        <td className="tnum py-3 pr-4 text-right">
                          {formatCount(row.applicants)}
                        </td>
                        <td className="tnum py-3 pr-4 text-right">
                          {row.units === null ? "—" : formatCount(row.units)}
                        </td>
                        <td className="py-3">
                          <DemandProvenance
                            row={row}
                            sourcesById={sourcesById}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Applicants per unit is demand context, not ballot odds. Priority
                schemes, household categories and flat-allocation rules affect
                actual chances.
              </p>
            </div>
          </details>
        ) : null}

        <div className="mt-4 flex justify-end border-t border-border/60 pt-4">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            Project record ·
            <LastVerified date={latestRetrievedAt(details)} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
