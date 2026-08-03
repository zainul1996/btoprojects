import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { MapPin } from "lucide-react";

import { api } from "../../../../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { ProjectCard } from "@/components/project-card";
import { SbfPoolCard } from "@/components/project/sbf-pool-card";
import { decodeTownParam } from "@/components/project/utils";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { WatchButton } from "@/components/watch-button";

type Props = { params: Promise<{ town: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { town: param } = await params;
  const townName = decodeTownParam(param);
  const { town } = await fetchQuery(api.projects.listByTown, { townName });
  const resolved = town?.name ?? townName;
  return {
    metadataBase: new URL("https://btoprojects.sg"),
    title: `BTO in ${resolved} | BTOProjects.sg`,
    description: `Every BTO project we track in ${resolved}: official prices, flat mix, waiting times and a full source trail.`,
    alternates: { canonical: `/bto/town/${param.toLowerCase()}` },
    openGraph: {
      title: `BTO in ${resolved} | BTOProjects.sg`,
      description: `Every BTO project we track in ${resolved}, with provenance on every fact.`,
      url: `/bto/town/${param.toLowerCase()}`,
      type: "website",
    },
  };
}

export default async function TownPage({ params }: Props) {
  const { town: param } = await params;
  const townName = decodeTownParam(param);
  const { town, projects } = await fetchQuery(api.projects.listByTown, {
    townName,
  });
  const resolvedName = town?.name ?? townName;

  // SBF town pools sit below BTO projects in their own section.
  const btoProjects = projects.filter(
    (s) => (s.project.saleType ?? "bto") === "bto",
  );
  const sbfProjects = projects.filter((s) => s.project.saleType === "sbf");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
      <header className="space-y-4 py-8 md:py-12">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground [&_a]:text-muted-foreground [&_a]:hover:text-teal-deep"
        >
          <Link href="/projects">Projects</Link>
          <span aria-hidden>/</span>
          <span className="text-ink">{resolvedName}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2.5">
            <h1>BTO in {resolvedName}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-medium">
                {town?.region ?? "Singapore"}
              </Badge>
              {town ? (
                <span className="text-sm text-muted-foreground">
                  {projects.length} tracked project{projects.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
          <WatchButton
            targetType="town"
            targetId={resolvedName}
            label={resolvedName}
            size="default"
            className="shrink-0"
          />
        </div>

        <p className="max-w-2xl text-base text-muted-foreground">
          Follow {resolvedName} and we&apos;ll alert you when a project
          launches here or official details change.
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={`No projects in ${resolvedName} yet`}
          hint={`Watch ${resolvedName} to hear when one launches.`}
          action={
            <WatchButton
              targetType="town"
              targetId={resolvedName}
              label={resolvedName}
              size="default"
            />
          }
        />
      ) : (
        <>
            {btoProjects.length > 0 ? (
              <Section title={`Projects in ${resolvedName}`}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {btoProjects.map((summary) => (
                    <ProjectCard key={summary.project._id} summary={summary} />
                  ))}
                </div>
              </Section>
            ) : null}

            {sbfProjects.length > 0 ? (
              <Section
                title="Balance flats (SBF)"
                description="Sold by town and flat type, not by project. Many are completed or near completion."
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {sbfProjects.map((summary) => (
                    <SbfPoolCard
                      key={summary.project._id}
                      summary={summary}
                      exerciseLabel={summary.exerciseLabel ?? undefined}
                    />
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        )}
    </div>
  );
}
