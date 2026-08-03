import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { Info } from "lucide-react";

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
import { Card, CardContent } from "@/components/ui/card";
import { WatchButton } from "@/components/watch-button";

type Props = { params: Promise<{ slug: string }> };

// Dedupes the Convex fetch between generateMetadata and the page render.
const getProjectDetails = cache(async (slug: string) =>
  fetchQuery(api.projects.getBySlug, { slug }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const details = await getProjectDetails(slug);
  if (!details) {
    return { title: "Project not found | BTOProjects.sg" };
  }
  const { project, town } = details;
  const townName = town?.name ?? project.region;
  const isSbf = project.saleType === "sbf";
  const title = isSbf
    ? `${project.name} — Sale of Balance Flats | BTOProjects.sg`
    : `${project.name} — ${townName} BTO | BTOProjects.sg`;
  return {
    metadataBase: new URL("https://btoprojects.sg"),
    title,
    description: project.description,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      title,
      description: project.description,
      url: `/projects/${project.slug}`,
      type: "article",
    },
  };
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
          <Link href="/projects">Projects</Link>
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
              <LifecycleChip stage={isSbf ? "sbf" : project.lifecycleStatus} />
              {project.classification !== "Unclassified" ? (
                <Badge variant="outline" className="font-medium">
                  {project.classification}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WatchButton
              targetType="project"
              targetId={project.slug}
              label={project.name}
              size="default"
            />
            <AddToCompareButton slug={project.slug} size="default" />
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
        title="Decision summary"
        description="Our read of who this project fits, derived from the facts below."
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

      {!isSbf && flatTypes.length > 0 ? (
        <Section
          title="Indicative affordability"
          description="A worked example from the lowest-priced flat type."
        >
          <Affordability details={details} />
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
