import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { CalendarClock, ExternalLink } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  exerciseStatusLabel,
  formatCount,
  formatIsoDate,
  townHref,
} from "@/components/project/utils";
import { Section } from "@/components/section";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = { params: Promise<{ exercise: string }> };

type Board = Awaited<ReturnType<typeof fetchBoard>>;
// The handler's early return widens `rows` to a union with `never[]`;
// the element type is what matters here.
type BoardRow = Board["rows"][number];

async function fetchBoard(key: string) {
  return await fetchQuery(api.exercises.sbfBoard, { exerciseKey: key });
}

/** Rows grouped by town, town order alphabetical (board arrives pre-sorted). */
function groupByTown(rows: BoardRow[]) {
  const towns: { town: string; region: string; projectSlug: string; classification: string; rows: BoardRow[] }[] = [];
  for (const row of rows) {
    const last = towns[towns.length - 1];
    if (last && last.town === row.town) {
      last.rows.push(row);
    } else {
      towns.push({
        town: row.town,
        region: row.region,
        projectSlug: row.projectSlug,
        classification: row.classification,
        rows: [row],
      });
    }
  }
  return towns;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { exercise: key } = await params;
  const board = await fetchBoard(key);
  if (!board.exercise || board.exercise.type !== "sbf") {
    return { title: "SBF exercise | BTOProjects.sg" };
  }
  const { exercise, totals } = board;
  const title = `${exercise.label} — Sale of Balance Flats | BTOProjects.sg`;
  const description =
    totals.units > 0
      ? `${formatCount(totals.units)} balance flats across ${totals.towns} towns in the ${exercise.label} exercise: supply and applications by town and flat type.`
      : `${exercise.label}: Sale of Balance Flats. The town and flat-type list is revealed on launch day.`;
  return {
    metadataBase: new URL("https://btoprojects.sg"),
    title,
    description,
    alternates: { canonical: `/sbf/${exercise.key}` },
    openGraph: {
      title,
      description,
      url: `/sbf/${exercise.key}`,
      type: "website",
    },
  };
}

export default async function SbfExercisePage({ params }: Props) {
  const { exercise: key } = await params;
  const board = await fetchBoard(key);

  if (!board.exercise || board.exercise.type !== "sbf") notFound();

  const { exercise, rows, totals } = board;
  const towns = groupByTown(rows);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
      <PageHeader
        breadcrumb={<Link href="/projects">Projects</Link>}
        title={exercise.label}
        lede="Balance flats from earlier launches, sold by town and flat type rather than by project, and often completed or near completion."
      />
      <div className="-mt-4 mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={exercise.status === "open" ? "default" : "secondary"}>
          {exerciseStatusLabel(exercise.status)}
        </Badge>
        {exercise.applicationEnd ? (
          <span className="text-sm text-muted-foreground">
            Applications {exercise.status === "closed" ? "closed" : "close"}{" "}
            {formatIsoDate(exercise.applicationEnd)}
          </span>
        ) : null}
      </div>

      {totals.units > 0 ? (
        <Section title="At a glance">
          <Card>
            <CardContent className="grid grid-cols-2 gap-6 p-5 md:p-6">
              <Stat label="Balance flats" value={formatCount(totals.units)} />
              <Stat label="Towns" value={formatCount(totals.towns)} />
            </CardContent>
          </Card>
        </Section>
      ) : null}

      <Section
        title="Balance flats by town"
        description="Supply and applications by town and flat type, from HDB's application-rate data."
      >
        {towns.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="The flat list is revealed on launch day"
            hint="HDB publishes the towns, flat types and prices when the exercise opens. We carry them here the same day."
            action={
              <Button render={<Link href="/upcoming" />} nativeButton={false}>
                See upcoming launches
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {towns.map((town) => (
              <Card key={town.town} className="gap-0 py-0">
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-base font-semibold text-ink">
                        <Link
                          href={townHref(town.town)}
                          className="hover:text-teal-deep"
                        >
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
                      className="text-sm font-medium hover:underline"
                    >
                      View the {town.town} pool →
                    </Link>
                  </div>

                  <div className="mt-4 overflow-x-auto">
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
                          <th scope="col" className="py-2.5 font-medium">
                            Per unit
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {town.rows.map((row) => (
                          <tr key={row.flatType}>
                            <td className="py-3 pr-4 font-medium text-ink">
                              {row.flatType}
                            </td>
                            <td className="tnum py-3 pr-4">
                              {formatCount(row.units)}
                            </td>
                            <td className="tnum py-3 pr-4">
                              {row.applicants !== null ? (
                                formatCount(row.applicants)
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="tnum py-3">
                              {row.applicants !== null && row.units > 0 ? (
                                (row.applicants / row.units).toFixed(1)
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <p className="text-sm text-muted-foreground">
        Prices and per-flat details (block, remaining lease, completion date)
        are listed on the{" "}
        <a
          href="https://homes.hdb.gov.sg"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 font-medium text-teal-deep hover:underline"
        >
          HDB Flat Portal
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>{" "}
        during the application window.
      </p>
    </div>
  );
}
