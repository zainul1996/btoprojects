import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { Info, MessageCircleQuestion } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { AddToCompareButton } from "@/components/add-to-compare-button";
import { LifecycleChip } from "@/components/lifecycle-chip";
import { Affordability } from "@/components/project/affordability";
import { ComparableResale } from "@/components/project/comparable-resale";
import { DecisionSummary } from "@/components/project/decision-summary";
import { LifecycleStepper } from "@/components/project/lifecycle-stepper";
import { OfficialFacts } from "@/components/project/official-facts";
import { ProjectLocation } from "@/components/project/project-location";
import { SbfAvailability } from "@/components/project/sbf-availability";
import { SourceLog } from "@/components/project/source-log";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WatchButton } from "@/components/watch-button";
import { getProjectDetails } from "@/lib/project-data";
import { createPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const details = await getProjectDetails(slug);
  if (!details) {
    return createPageMetadata({
      title: "Project not found",
      description: "This BTO or SBF project page is not available.",
      path: `/projects/${slug}`,
      index: false,
    });
  }
  const { project, town } = details;
  const townName = town?.name ?? project.region;
  const isSbf = project.saleType === "sbf";
  const title = isSbf
    ? `${project.name}: Sale of Balance Flats in ${townName}`
    : `${project.name}: ${townName} BTO project`;
  return createPageMetadata({
    title,
    description: project.description,
    path: `/projects/${project.slug}`,
  });
}

/** Current month as "YYYY-MM", computed on the server per request. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const details = await getProjectDetails(slug);
  if (!details) notFound();

  const { project, town, exercise, flatTypes } = details;
  const townName = town?.name ?? project.region;
  const isAnnounced = project.lifecycleStatus === "announced";
  const isSbf = project.saleType === "sbf";
  const hasPublishedPrice = flatTypes.some((flat) => flat.minPrice > 0);
  const plannerPrompt = `What should I know about ${project.name} (${isSbf ? "SBF" : "BTO"})? Explain the fit, trade-offs and any missing data.`;

  // Announced and SBF rows have no usable prices to compare against (0 =
  // TBC) — skip the fetch and the resale section entirely for SBF pools.
  const comparables = isAnnounced || isSbf
    ? null
    : await fetchQuery(api.projects.comparables, {
        projectId: project._id,
        flatTypes: flatTypes.map((f) => f.type),
        asOfMonth: currentMonth(),
      });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 md:px-6">
      <header className="space-y-4 py-8 md:py-12">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground [&_a]:text-muted-foreground [&_a]:hover:text-teal-deep"
        >
          <Link href="/explore">Projects</Link>
          {exercise ? (
            <>
              <span aria-hidden>/</span>
              <Link
                href={
                  exercise.type === "sbf"
                    ? `/sbf/${exercise.key}`
                    : `/bto/${exercise.key}`
                }
              >
                {exercise.label}
              </Link>
            </>
          ) : null}
          <span aria-hidden>/</span>
          <span className="text-ink">{project.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2.5">
            <h1>{project.name}</h1>
            <p className="text-muted-foreground">
              {townName} · {project.region}
              {exercise ? ` · ${exercise.label}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  isSbf
                    ? "border-teal-deep/25 bg-teal-subtle font-medium text-teal-deeper"
                    : "font-medium text-muted-foreground"
                }
              >
                {isSbf ? "SBF" : "BTO"}
              </Badge>
              {!isSbf ? (
                <LifecycleChip stage={project.lifecycleStatus} />
              ) : null}
              {project.classification !== "Unclassified" ? (
                <Badge variant="outline" className="font-medium">
                  {project.classification}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
            <AddToCompareButton
              slug={project.slug}
              label={project.name}
              size="default"
              variant="default"
              className="col-span-2 w-full sm:col-span-1 sm:w-auto"
            />
            <WatchButton
              targetType="project"
              targetId={project.slug}
              label={project.name}
              size="default"
              className="w-full sm:w-auto"
            />
            <Link
              href={`/planner?prompt=${encodeURIComponent(plannerPrompt)}`}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full sm:w-auto",
              )}
            >
              <MessageCircleQuestion data-icon="inline-start" aria-hidden />
              Ask AI Planner
            </Link>
          </div>
        </div>

        <p className="max-w-3xl text-base text-muted-foreground">
          {project.description}
        </p>

        {isSbf ? (
          <div
            role="note"
            className="flex max-w-3xl items-start gap-2.5 rounded-xl border border-navy/20 bg-navy/5 px-4 py-3"
          >
            <Info className="mt-0.5 size-4 shrink-0 text-navy" aria-hidden />
            <div className="space-y-2">
              <p className="text-sm text-navy">
                SBF flats are sold by town and flat type, not by project.
                Block, remaining lease, exact price and completion date vary
                per flat and are listed on the{" "}
                <a
                  href="https://homes.hdb.gov.sg"
                  target="_blank"
                  rel="noopener"
                  className="font-medium underline underline-offset-2"
                >
                  HDB Flat Portal
                </a>{" "}
                during the sales window.
              </p>
              {project.notes ? (
                <p className="text-xs text-navy/70">{project.notes}</p>
              ) : null}
            </div>
          </div>
        ) : isAnnounced && project.notes ? (
          <div
            role="note"
            className="flex max-w-3xl items-start gap-2.5 rounded-xl border border-navy/20 bg-navy/5 px-4 py-3"
          >
            <Info className="mt-0.5 size-4 shrink-0 text-navy" aria-hidden />
            <p className="text-sm text-navy">{project.notes}</p>
          </div>
        ) : null}
      </header>

      <Section
        title="At a glance"
        description="The price, timeline, access and rules that matter most for this decision."
      >
        <DecisionSummary details={details} />
      </Section>

      {isSbf ? (
        <Section
          title="Flat-type availability"
          description={`Supply and applications for the ${townName} pool, from HDB's application-rate data.`}
        >
          <SbfAvailability details={details} />
        </Section>
      ) : (
        <Section
          title="Official facts"
          description="From HDB's launch materials, with the source of every figure."
        >
          <OfficialFacts details={details} />
        </Section>
      )}

      <Section title="Location">
        <ProjectLocation details={details} />
      </Section>

      {!isSbf && !isAnnounced && hasPublishedPrice ? (
        <Section
          title="Plan affordability"
          description="Compare transparent HDB and financial-institution loan scenarios."
        >
          <Affordability flatTypes={flatTypes} />
        </Section>
      ) : null}

      {!isSbf ? (
        <Section
          title="Comparable resale"
          description={`What resale flats are actually transacting for in ${townName}.`}
        >
          {comparables ? (
            <ComparableResale townName={townName} comparables={comparables} />
          ) : (
            <Card>
              <CardContent className="p-5 md:p-6">
                <p className="text-sm text-muted-foreground">
                  Resale comparisons arrive at launch. They need the official
                  price list to compare against.
                </p>
              </CardContent>
            </Card>
          )}
        </Section>
      ) : null}

      {!isSbf ? (
        <Section title="Lifecycle">
          <Card>
            <CardContent className="p-5 md:p-6">
              <LifecycleStepper status={project.lifecycleStatus} />
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            This page follows {project.name} through its full lifecycle.
          </p>
        </Section>
      ) : null}

      <Section
        title="Source log"
        description="Every source behind the facts on this page."
      >
        <SourceLog details={details} />
      </Section>
    </div>
  );
}
