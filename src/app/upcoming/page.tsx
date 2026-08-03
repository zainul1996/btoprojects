import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { CalendarClock } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { formatCount, formatIsoDate } from "@/components/project/utils";
import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Launch Calendar — BTOProjects.sg",
  description:
    "Track open, officially announced and previous HDB BTO and SBF exercises, with estimates kept clearly separate.",
};

type ExerciseRow = FunctionReturnType<typeof api.exercises.list>[number];

const EXPECTED_SBF_KEY = "2027-02-sbf";
const EXPECTED_BTO_KEY = "2027-02";
const EXPECTED_FEBRUARY_CUTOFF = "2027-03-01";

function currentIsoDate(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const STATUS_CHIP: Record<
  ExerciseRow["exercise"]["status"],
  { label: string; className: string }
> = {
  open: {
    label: "Open now",
    className: "border-teal-deep/20 bg-teal-subtle text-teal-deeper",
  },
  closed: {
    label: "Closed",
    className: "border-border bg-muted text-muted-foreground",
  },
  upcoming: {
    label: "Upcoming",
    className: "border-navy/20 bg-navy/5 text-navy",
  },
};

function exerciseHref(row: ExerciseRow): string {
  const { exercise } = row;
  return exercise.type === "sbf"
    ? `/sbf/${exercise.key}`
    : `/bto/${exercise.key}`;
}

function ExerciseCard({
  row,
  statusOverride,
}: {
  row: ExerciseRow;
  statusOverride?: ExerciseRow["exercise"]["status"];
}) {
  const { exercise, projectCount } = row;
  const isSbf = exercise.type === "sbf";
  const displayStatus = statusOverride ?? exercise.status;
  const status = STATUS_CHIP[displayStatus];
  const countLabel = isSbf
    ? `${formatCount(projectCount)} town ${projectCount === 1 ? "pool" : "pools"}`
    : `${formatCount(projectCount)} ${projectCount === 1 ? "project" : "projects"}`;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{isSbf ? "SBF" : "BTO"}</Badge>
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium",
              status.className,
            )}
          >
            {status.label}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">{exercise.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectCount === 0 && isSbf
              ? "Town and flat-type list published when applications open"
              : countLabel}
          </p>
          {exercise.applicationEnd ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Applications{" "}
              {displayStatus === "open"
                ? "close"
                : displayStatus === "closed"
                  ? "closed"
                  : "close"}{" "}
              <span className="tnum">
                {formatIsoDate(exercise.applicationEnd)}
              </span>
            </p>
          ) : exercise.status === "upcoming" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Application dates not published
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <SourceBadge variant="official" size="sm" />
          <Link
            href={exerciseHref(row)}
            className="rounded-sm text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {isSbf ? "View balance flats →" : "View projects →"}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ExerciseGrid({
  rows,
  emptyMessage,
  statusOverride,
}: {
  rows: ExerciseRow[];
  emptyMessage: string;
  statusOverride?: ExerciseRow["exercise"]["status"];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <ExerciseCard
          key={row.exercise._id}
          row={row}
          statusOverride={statusOverride}
        />
      ))}
    </div>
  );
}

export default async function UpcomingPage() {
  const exercises = [...(await fetchQuery(api.exercises.list, {}))].sort(
    (a, b) => b.exercise.key.localeCompare(a.exercise.key),
  );
  const today = currentIsoDate();

  // Legacy deployments may not have the explicit estimate flag until the
  // additive schema change and seed update reach them.
  const expectedSbf = exercises.find(
    (row) =>
      row.exercise.isEstimate === true ||
      (row.exercise.isEstimate === undefined &&
        row.exercise.key === EXPECTED_SBF_KEY &&
        row.exercise.status === "upcoming" &&
        row.projectCount === 0 &&
        !row.exercise.applicationEnd),
  );
  const officialExercises = exercises.filter(
    (row) => row !== expectedSbf && row.exercise.isEstimate !== true,
  );
  const isExpiredOpen = (row: ExerciseRow) =>
    row.exercise.status === "open" &&
    row.exercise.applicationEnd !== undefined &&
    row.exercise.applicationEnd < today;
  const openExercises = officialExercises.filter(
    (row) => row.exercise.status === "open" && !isExpiredOpen(row),
  );
  const announcedExercises = officialExercises.filter(
    (row) => row.exercise.status === "upcoming",
  );
  const previousExercises = officialExercises.filter(
    (row) => row.exercise.status === "closed" || isExpiredOpen(row),
  );
  const hasOfficialExpectedBto = officialExercises.some(
    (row) =>
      row.exercise.type === "bto" &&
      row.exercise.key === EXPECTED_BTO_KEY,
  );
  const showExpectedBto =
    !hasOfficialExpectedBto && today < EXPECTED_FEBRUARY_CUTOFF;

  // The latest closed SBF exercise provides official context for the cadence
  // estimate without turning that estimate into an official claim.
  const sbfRows = exercises.filter((row) => row.exercise.type === "sbf");
  const lastClosedSbf = sbfRows
    .filter((row) => row.exercise.status === "closed")
    .sort((a, b) => b.exercise.key.localeCompare(a.exercise.key))[0];
  const lastSbfBoard = lastClosedSbf
    ? await fetchQuery(api.exercises.sbfBoard, {
        exerciseKey: lastClosedSbf.exercise.key,
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
      <PageHeader
        title="Launch Calendar"
        lede="Open, announced and previous HDB BTO and SBF exercises, with expected dates kept separate from official information."
      />

      <Section
        title="Open now"
        description="BTO and SBF exercises currently accepting applications."
      >
        <ExerciseGrid
          rows={openExercises}
          emptyMessage="No BTO or SBF exercise is open for applications right now."
        />
      </Section>

      <Section
        title="Officially announced"
        description="Upcoming exercises HDB has announced. They are not open for applications yet."
      >
        <ExerciseGrid
          rows={announcedExercises}
          emptyMessage="HDB has not announced another upcoming BTO or SBF exercise yet."
        />
      </Section>

      {showExpectedBto || expectedSbf ? (
        <Section
          title="Expected next"
          description="Our cadence estimates, not HDB announcements. Dates and contents may change."
        >
          <div className="grid max-w-5xl gap-4 md:grid-cols-2">
            {showExpectedBto ? (
              <Card className="gap-0 border-dashed py-0">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3.5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <CalendarClock className="size-5" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        February 2027 BTO exercise
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Estimated from the usual February, June and October BTO
                        rhythm. It becomes official only when HDB announces it.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                    <SourceBadge variant="analysis" size="sm" />
                    <SourceBadge variant="estimated" size="sm" />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {expectedSbf ? (
              <Card className="gap-0 border-dashed py-0">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3.5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <CalendarClock className="size-5" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        {expectedSbf.exercise.label} exercise
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Estimated from SBF running with the February BTO
                        exercise each year since 2024. Towns and flat types are
                        not predicted.
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto space-y-3 border-t border-border/60 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <SourceBadge variant="analysis" size="sm" />
                      <SourceBadge variant="estimated" size="sm" />
                    </div>
                    {lastSbfBoard && lastSbfBoard.totals.units > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <SourceBadge variant="official" size="sm" />
                        <span>
                          Previous SBF:{" "}
                          <span className="tnum">
                            {formatCount(lastSbfBoard.totals.units)}
                          </span>{" "}
                          flats across{" "}
                          <span className="tnum">
                            {formatCount(lastSbfBoard.totals.towns)}
                          </span>{" "}
                          towns
                        </span>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section
        title="Previous exercises"
        description="Closed BTO and SBF exercises, kept for reference."
      >
        {previousExercises.length > 0 ? (
          <details className="group rounded-xl border border-border bg-card">
            <summary className="cursor-pointer rounded-xl px-5 py-4 text-sm font-medium text-ink marker:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Browse{" "}
              <span className="tnum">{previousExercises.length}</span> closed{" "}
              {previousExercises.length === 1 ? "exercise" : "exercises"}
            </summary>
            <div className="border-t border-border px-4 py-4 md:px-5 md:py-5">
              <ExerciseGrid
                rows={previousExercises}
                emptyMessage="No previous exercises are available."
                statusOverride="closed"
              />
            </div>
          </details>
        ) : (
          <ExerciseGrid
            rows={previousExercises}
            emptyMessage="No previous exercises are available."
            statusOverride="closed"
          />
        )}
      </Section>

      <div className="flex flex-col gap-2 border-t border-border py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Ready to narrow down the exercises that fit your plans?</p>
        <Link
          href="/explore"
          className="w-fit rounded-sm font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Browse projects and towns →
        </Link>
      </div>
    </div>
  );
}
