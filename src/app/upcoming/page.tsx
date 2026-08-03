import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { CalendarClock } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { formatCount } from "@/components/project/utils";
import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upcoming launches — BTOProjects.sg",
  description:
    "Officially announced HDB BTO and SBF exercises, plus an honest note on what's expected next.",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2026-06-24" → "24 Jun 2026". Deterministic — no Intl locale drift. */
function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  open: {
    label: "Open",
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

export default async function UpcomingPage() {
  const exercises = [...(await fetchQuery(api.exercises.list, {}))].sort(
    (a, b) => b.exercise.key.localeCompare(a.exercise.key),
  );

  // Data for the "Expected next SBF" card: the announced upcoming row gives
  // the label; the most recent closed SBF board gives the last pool's size.
  const sbfRows = exercises.filter((row) => row.exercise.type === "sbf");
  const upcomingSbf = sbfRows.find((row) => row.exercise.status === "upcoming");
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
        title="Upcoming launches"
        lede="What's officially on the calendar, and an honest note on what isn't yet."
      />

      <Section
        title="Officially announced"
        description="Published by HDB. Dates and project lists come from the official release."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {exercises.map(({ exercise, projectCount }) => {
            const status = STATUS_CHIP[exercise.status] ?? STATUS_CHIP.closed;
            const isSbf = exercise.type === "sbf";
            return (
              <Card key={exercise._id} className="gap-0 py-0">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        {exercise.label}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {projectCount === 0 && exercise.status === "upcoming" ? (
                          "Composition revealed on launch day"
                        ) : (
                          <>
                            <span className="tnum">{projectCount}</span>{" "}
                            {isSbf
                              ? projectCount === 1
                                ? "town pool"
                                : "town pools"
                              : projectCount === 1
                                ? "project"
                                : "projects"}
                          </>
                        )}
                        {exercise.applicationEnd
                          ? ` · Applications ${
                              exercise.status === "closed" ? "closed" : "until"
                            } ${formatIsoDate(exercise.applicationEnd)}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <SourceBadge variant="official" size="sm" />
                    <Link
                      href={isSbf ? `/sbf/${exercise.key}` : `/bto/${exercise.key}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {isSbf ? "View balance flats →" : "View projects →"}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section
        title="Expected next"
        description="Not official. This is our reading of HDB's usual rhythm, labelled as such."
      >
        <div className="grid max-w-5xl gap-4 md:grid-cols-2">
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
                    HDB typically runs exercises in February, June and October.
                    Details exist only when HDB publishes them. We&rsquo;ll list
                    them here the day they&rsquo;re official.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                <SourceBadge variant="analysis" size="sm" />
                <SourceBadge variant="estimated" size="sm" />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 border-dashed py-0">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <CalendarClock className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">
                    {upcomingSbf
                      ? `${upcomingSbf.exercise.label} exercise`
                      : "February 2027 SBF exercise"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    SBF has run alongside the February BTO every year since
                    2024.
                    {lastSbfBoard && lastSbfBoard.totals.units > 0
                      ? ` The last pool offered ${formatCount(lastSbfBoard.totals.units)} flats across ${lastSbfBoard.totals.towns} towns; about 1 in 5 was already completed, per HDB's press release.`
                      : ""}{" "}
                    The town and flat-type list is only revealed on launch day.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <SourceBadge variant="analysis" size="sm" />
                  <SourceBadge variant="estimated" size="sm" />
                </div>
                <Link
                  href="/watchlist"
                  className="text-sm font-medium hover:underline"
                >
                  Watch a town to get alerted →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <p className="pb-12 text-sm text-muted-foreground">
        Want to know the moment a launch drops?{" "}
        <Link href="/explore" className="font-medium hover:underline">
          Watch a town to get alerted →
        </Link>
      </p>
    </div>
  );
}
