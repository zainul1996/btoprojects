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
  return {
    metadataBase: new URL("https://btoprojects.sg"),
    title: `${project.name} — ${townName} BTO | BTOProjects.sg`,
    description: project.description,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      title: `${project.name} — ${townName} BTO | BTOProjects.sg`,
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

  // Announced projects have no prices to compare against — skip the fetch
  // and render a placeholder in the section below.
  const comparables = isAnnounced
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
              <Link href={`/bto/${exercise.key}`}>{exercise.label}</Link>
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
              <LifecycleChip stage={project.lifecycleStatus} />
              <Badge variant="outline" className="font-medium">
                {project.classification}
              </Badge>
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

        {isAnnounced && project.notes ? (
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

      <Section
        title="Official facts"
        description="From HDB's launch materials, with the source of every figure."
      >
        <OfficialFacts details={details} />
      </Section>

      <Section title="Location">
        <ProjectLocation details={details} />
      </Section>

      {flatTypes.length > 0 ? (
        <Section
          title="Indicative affordability"
          description="A worked example from the lowest-priced flat type."
        >
          <Affordability details={details} />
        </Section>
      ) : null}

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
                Resale comparisons arrive at launch — they need the official
                price list to compare against.
              </p>
            </CardContent>
          </Card>
        )}
      </Section>

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

      <Section
        title="Source log"
        description="Every source behind the facts on this page."
      >
        <SourceLog details={details} />
      </Section>
    </div>
  );
}
