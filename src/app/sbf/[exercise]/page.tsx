import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { CalendarClock, ExternalLink } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import {
  SbfBoard,
  type SbfTownGroup,
} from "@/components/explore/sbf-board";
import {
  effectiveExerciseStatus,
  todayIso,
} from "@/components/explore/filter-model";
import { PageHeader } from "@/components/page-header";
import {
  exerciseStatusLabel,
  formatCount,
  formatIsoDate,
} from "@/components/project/utils";
import { Section } from "@/components/section";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  createPageMetadata,
  SITE_URL,
} from "@/lib/seo";

type Props = {
  params: Promise<{ exercise: string }>;
  searchParams: Promise<{
    town?: string | string[];
    flat?: string | string[];
    sort?: string | string[];
  }>;
};

type Board = Awaited<ReturnType<typeof fetchBoard>>;
// The handler's early return widens `rows` to a union with `never[]`;
// the element type is what matters here.
type BoardRow = Board["rows"][number];

const fetchBoard = cache(async (key: string) =>
  fetchQuery(api.exercises.sbfBoard, { exerciseKey: key }),
);

/** Rows grouped by town, town order alphabetical (board arrives pre-sorted). */
function groupByTown(rows: BoardRow[]) {
  const towns: SbfTownGroup[] = [];
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
    return createPageMetadata({
      title: "SBF exercise not found",
      description: "This HDB Sale of Balance Flats exercise is not available.",
      path: `/sbf/${key}`,
      index: false,
    });
  }
  const { exercise, totals } = board;
  const title = `${exercise.label}: Sale of Balance Flats`;
  const description =
    totals.units > 0
      ? `${formatCount(totals.units)} balance flats across ${totals.towns} towns in the ${exercise.label} exercise: supply and applications by town and flat type.`
      : `${exercise.label}: Sale of Balance Flats. The town and flat-type list is revealed on launch day.`;
  return createPageMetadata({
    title,
    description,
    path: `/sbf/${exercise.key}`,
  });
}

export default async function SbfExercisePage({
  params,
  searchParams: searchParamsPromise,
}: Props) {
  const [{ exercise: key }, searchParams] = await Promise.all([
    params,
    searchParamsPromise,
  ]);
  const board = await fetchBoard(key);

  if (!board.exercise || board.exercise.type !== "sbf") notFound();

  const { exercise, rows, totals } = board;
  const effectiveStatus = effectiveExerciseStatus(exercise, todayIso());
  const towns = groupByTown(rows);
  const path = `/sbf/${exercise.key}`;
  const sbfJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(path)}#page`,
    url: absoluteUrl(path),
    name: `${exercise.label}: Sale of Balance Flats`,
    description:
      totals.units > 0
        ? `${formatCount(totals.units)} balance flats across ${totals.towns} towns, grouped by town and flat type.`
        : "Sale of Balance Flats exercise details, with the town and flat-type list added when HDB publishes it.",
    numberOfItems: towns.length,
    inLanguage: "en-SG",
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
      <JsonLd id="sbf-exercise-schema" data={sbfJsonLd} />
      <JsonLd
        id="sbf-exercise-breadcrumb-schema"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Launch calendar", path: "/upcoming" },
          { name: exercise.label, path },
        ])}
      />
      <PageHeader
        breadcrumb={<Link href="/explore">Projects</Link>}
        title={exercise.label}
        lede="Balance flats from earlier launches, sold by town and flat type rather than by project, and often completed or near completion."
      />
      <div className="-mt-4 mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={effectiveStatus === "open" ? "default" : "secondary"}>
          {exerciseStatusLabel(effectiveStatus)}
        </Badge>
        {exercise.applicationEnd ? (
          <span className="text-sm text-muted-foreground">
            Applications {effectiveStatus === "closed" ? "closed" : "close"}{" "}
            {formatIsoDate(exercise.applicationEnd)}
          </span>
        ) : null}
      </div>

      {totals.units > 0 ? (
        <Section title="At a glance">
          <div className="grid max-w-xl grid-cols-2 gap-6 border-y border-border py-5">
            <Stat label="Balance flats" value={formatCount(totals.units)} />
            <Stat label="Towns" value={formatCount(totals.towns)} />
          </div>
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
            hint="HDB publishes the towns, flat types and prices when the exercise opens. We add them after HDB publishes them."
            action={
              <Link href="/upcoming" className={buttonVariants()}>
                See upcoming launches
              </Link>
            }
          />
        ) : (
          <SbfBoard
            towns={towns}
            initialFilters={{
              town:
                typeof searchParams.town === "string"
                  ? searchParams.town
                  : undefined,
              flat:
                typeof searchParams.flat === "string"
                  ? searchParams.flat
                  : undefined,
              sort:
                typeof searchParams.sort === "string"
                  ? searchParams.sort
                  : undefined,
            }}
          />
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
