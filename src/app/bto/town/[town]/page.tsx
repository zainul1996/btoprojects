import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { MapPin } from "lucide-react";

import { api } from "../../../../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { ProjectCard } from "@/components/project-card";
import { decodeTownParam, townHref } from "@/components/project/utils";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { WatchButton } from "@/components/watch-button";
import { JsonLd } from "@/components/seo/json-ld";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  createPageMetadata,
  SITE_URL,
} from "@/lib/seo";

type Props = { params: Promise<{ town: string }> };

const getTownProjects = cache(async (townName: string) =>
  fetchQuery(api.projects.listByTown, { townName }),
);

function townHeading(name: string, btoCount: number, sbfCount: number): string {
  if (btoCount > 0 && sbfCount > 0) return `BTO and SBF in ${name}`;
  if (btoCount > 0) return `BTO projects in ${name}`;
  if (sbfCount > 0) return `SBF in ${name}`;
  return `Projects in ${name}`;
}

function townDescription(
  name: string,
  btoCount: number,
  sbfCount: number,
): string {
  if (btoCount > 0 && sbfCount > 0) {
    return `BTO projects and Sale of Balance Flats pools tracked in ${name}, with official details and a full source trail.`;
  }
  if (btoCount > 0) {
    return `BTO projects tracked in ${name}, with official details and a full source trail.`;
  }
  if (sbfCount > 0) {
    return `Sale of Balance Flats pools tracked in ${name}, with official details and a full source trail.`;
  }
  return `No BTO projects or Sale of Balance Flats pools are currently tracked in ${name}.`;
}

function townCountLabel(btoCount: number, sbfCount: number): string {
  if (btoCount > 0 && sbfCount > 0) {
    return `${btoCount} BTO project${btoCount === 1 ? "" : "s"} · ${sbfCount} SBF pool${sbfCount === 1 ? "" : "s"}`;
  }
  if (btoCount > 0) {
    return `${btoCount} BTO project${btoCount === 1 ? "" : "s"}`;
  }
  if (sbfCount > 0) {
    return `${sbfCount} SBF pool${sbfCount === 1 ? "" : "s"}`;
  }
  return "No tracked projects or pools";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { town: param } = await params;
  const townName = decodeTownParam(param);
  const { town, projects } = await getTownProjects(townName);
  const resolved = town?.name ?? townName;
  const btoCount = projects.filter(
    (summary) => (summary.project.saleType ?? "bto") === "bto",
  ).length;
  const sbfCount = projects.filter(
    (summary) => summary.project.saleType === "sbf",
  ).length;
  const heading = townHeading(resolved, btoCount, sbfCount);
  const description = townDescription(resolved, btoCount, sbfCount);
  return createPageMetadata({
    title: heading,
    description,
    path: townHref(resolved),
    index: projects.length > 0,
  });
}

export default async function TownPage({ params }: Props) {
  const { town: param } = await params;
  const townName = decodeTownParam(param);
  const { town, projects } = await getTownProjects(townName);
  const resolvedName = town?.name ?? townName;

  // SBF town pools sit below BTO projects in their own section.
  const btoProjects = projects.filter(
    (s) => (s.project.saleType ?? "bto") === "bto",
  );
  const sbfProjects = projects.filter((s) => s.project.saleType === "sbf");
  const heading = townHeading(
    resolvedName,
    btoProjects.length,
    sbfProjects.length,
  );
  const path = townHref(resolvedName);
  const townJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(path)}#page`,
    url: absoluteUrl(path),
    name: heading,
    description: townDescription(
      resolvedName,
      btoProjects.length,
      sbfProjects.length,
    ),
    numberOfItems: projects.length,
    inLanguage: "en-SG",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: {
      "@type": "Place",
      name: resolvedName,
      address: {
        "@type": "PostalAddress",
        addressLocality: resolvedName,
        addressRegion: town?.region ?? "Singapore",
        addressCountry: "SG",
      },
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
      <JsonLd id="town-page-schema" data={townJsonLd} />
      <JsonLd
        id="town-breadcrumb-schema"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Explore projects", path: "/explore" },
          { name: resolvedName, path },
        ])}
      />
      <header className="space-y-4 py-8 md:py-12">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground [&_a]:text-muted-foreground [&_a]:hover:text-teal-deep"
        >
          <Link href="/explore">Projects</Link>
          <span aria-hidden>/</span>
          <span className="text-ink">{resolvedName}</span>
        </nav>

        <div>
          <div className="min-w-0 space-y-2.5">
            <h1>{heading}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-medium">
                {town?.region ?? "Singapore"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {townCountLabel(btoProjects.length, sbfProjects.length)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-ink">Get {resolvedName} updates</p>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              We&apos;ll alert you when a project launches or official details
              change.
            </p>
          </div>
          <WatchButton
            targetType="town"
            targetId={resolvedName}
            label={resolvedName}
            size="default"
            className="shrink-0 border border-border bg-background px-3 hover:bg-muted"
          />
        </div>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={`No projects in ${resolvedName} yet`}
          hint={`Watch ${resolvedName} to hear when one launches.`}
          action={
            <Link href="/explore" className="text-sm font-medium text-teal-deep hover:underline">
              Browse all projects
            </Link>
          }
        />
      ) : (
        <>
          {btoProjects.length > 0 ? (
            <Section title={`BTO projects in ${resolvedName}`}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {btoProjects.map((summary) => (
                  <ProjectCard
                    key={summary.project._id}
                    summary={summary}
                    context="town"
                  />
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
                  <ProjectCard
                    key={summary.project._id}
                    summary={summary}
                    context="town"
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
