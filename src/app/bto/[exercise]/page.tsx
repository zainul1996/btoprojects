import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { CalendarX } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Price } from "@/components/price";
import { ProjectCard } from "@/components/project-card";
import {
  exerciseStatusLabel,
  formatCount,
  formatIsoDate,
  fromPrice,
} from "@/components/project/utils";
import { Section } from "@/components/section";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/json-ld";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  createPageMetadata,
  SITE_URL,
} from "@/lib/seo";

type Props = { params: Promise<{ exercise: string }> };

const resolveExercise = cache(async (key: string) => {
  const rows = await fetchQuery(api.exercises.list, {});
  return rows.find((row) => row.exercise.key === key) ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { exercise: key } = await params;
  const row = await resolveExercise(key);
  if (!row) {
    return createPageMetadata({
      title: "BTO exercise not found",
      description: "This HDB BTO exercise is not available.",
      path: `/bto/${key}`,
      index: false,
    });
  }
  const { exercise, projectCount } = row;
  return createPageMetadata({
    title: `${exercise.label} projects`,
    description: `Explore ${projectCount} project${projectCount === 1 ? "" : "s"} in the ${exercise.label} launch, with available flat supply, prices, timing, location context and clearly labelled sources.`,
    path: `/bto/${exercise.key}`,
  });
}

export default async function ExercisePage({ params }: Props) {
  const { exercise: key } = await params;
  const [row, projects] = await Promise.all([
    resolveExercise(key),
    fetchQuery(api.projects.listByExercise, { exerciseKey: key }),
  ]);

  if (!row) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
        <EmptyState
          icon={CalendarX}
          title={`No exercise called "${key}"`}
          hint="BTO exercises are keyed by year and month, for example /bto/2026-06. Browse everything we track."
          action={
            <Link href="/explore" className={buttonVariants()}>
              Browse all projects
            </Link>
          }
        />
      </div>
    );
  }

  // SBF exercises live under /sbf/{key}; a hand-edited /bto/{sbf-key} URL
  // would render town pools as broken BTO cards.
  if (row.exercise.type !== "bto") {
    redirect(`/sbf/${row.exercise.key}`);
  }

  const { exercise } = row;
  const totalUnits = projects.reduce((sum, s) => sum + s.project.totalUnits, 0);
  const towns = new Set(
    projects.map((s) => s.town?.name).filter((name) => name !== undefined),
  );
  const entryPrices = projects
    .map((s) => fromPrice(s.flatTypes))
    .filter((price): price is number => price !== null);
  const lowestFrom = entryPrices.length ? Math.min(...entryPrices) : null;
  const path = `/bto/${exercise.key}`;
  const exerciseJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(path)}#page`,
    url: absoluteUrl(path),
    name: `${exercise.label} projects`,
    description: `${projects.length} BTO project${projects.length === 1 ? "" : "s"} tracked in this HDB sales exercise.`,
    numberOfItems: projects.length,
    inLanguage: "en-SG",
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
      <JsonLd id="bto-exercise-schema" data={exerciseJsonLd} />
      <JsonLd
        id="bto-exercise-breadcrumb-schema"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Launch calendar", path: "/upcoming" },
          { name: exercise.label, path },
        ])}
      />
      <PageHeader
        breadcrumb={<Link href="/explore">Projects</Link>}
        title={exercise.label}
        lede={
          exercise.applicationEnd
            ? `Applications ${exercise.status === "open" ? "close" : "closed"} ${formatIsoDate(exercise.applicationEnd)}.`
            : undefined
        }
      />
      <div className="-mt-4 mb-2 flex items-center gap-2">
        <Badge variant={exercise.status === "open" ? "default" : "secondary"}>
          {exerciseStatusLabel(exercise.status)}
        </Badge>
      </div>

      <Section title="At a glance">
        <Card>
          <CardContent className="grid grid-cols-2 gap-6 p-5 md:grid-cols-4 md:p-6">
            <Stat label="Projects" value={formatCount(projects.length)} />
            <Stat label="Total units" value={formatCount(totalUnits)} />
            <Stat label="Towns" value={formatCount(towns.size)} />
            <Stat
              label="Lowest from-price"
              value={lowestFrom !== null ? <Price value={lowestFrom} /> : "—"}
            />
          </CardContent>
        </Card>
      </Section>

      <Section title="Projects in this exercise">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((summary) => (
            <ProjectCard key={summary.project._id} summary={summary} />
          ))}
        </div>
      </Section>
    </div>
  );
}
