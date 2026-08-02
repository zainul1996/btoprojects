import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { Bell, History, ListChecks } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { ProjectCard } from "@/components/project-card";
import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { Button } from "@/components/ui/button";

// Launch data changes between deploys — fetch fresh per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BTOProjects.sg — Plan your HDB home with confidence",
  description:
    "Every BTO project, structured and cited — explore, compare and follow the places you care about.",
};

const FEATURES = [
  {
    icon: ListChecks,
    title: "Personalised shortlist",
    line: "Tell the planner your budget and timeline; get a ranked shortlist with reasons and sources.",
  },
  {
    icon: Bell,
    title: "Follow any place",
    line: "Watch a project, town or MRT station and get alerted when official details change.",
  },
  {
    icon: History,
    title: "Lifecycle record",
    line: "Every project keeps a dated history — from announcement to launch, construction and MOP.",
  },
] as const;

export default async function HomePage() {
  const exercises = await fetchQuery(api.exercises.list, {});
  const latest = [...exercises].sort((a, b) =>
    b.exercise.key.localeCompare(a.exercise.key),
  )[0];
  const latestProjects = latest
    ? await fetchQuery(api.projects.listByExercise, {
        exerciseKey: latest.exercise.key,
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Hero — one idea, one primary action */}
      <section className="px-4 pt-16 pb-12 md:px-6 md:pt-24 md:pb-16">
        <p className="text-sm font-medium text-teal-deep">
          Singapore BTO, organised
        </p>
        <h1 className="mt-3 max-w-2xl">Plan your HDB home with confidence</h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
          Every BTO project, structured and cited — explore, compare and follow
          the places you care about.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            render={<Link href="/explore" />}
            nativeButton={false}
          >
            Explore projects
          </Button>
          <Button
            size="lg"
            variant="ghost"
            render={<Link href="/planner" />}
            nativeButton={false}
          >
            Try the planner
          </Button>
        </div>
      </section>

      {/* Signature features — one line each */}
      <section className="border-t border-border px-4 py-10 md:px-6 md:py-14">
        <div className="grid gap-8 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex gap-3.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-subtle text-teal-deeper">
                <feature.icon className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">
                  {feature.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {feature.line}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Latest launch */}
      {latest ? (
        <Section className="px-4 md:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-teal-deep">
                Latest launch
              </p>
              <h2>{latest.exercise.label}</h2>
            </div>
            <Link
              href={`/bto/${latest.exercise.key}`}
              className="text-sm font-medium hover:underline"
            >
              View all{" "}
              <span className="tnum">{latest.projectCount}</span> →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latestProjects.slice(0, 4).map((summary) => (
              <ProjectCard key={summary.project.slug} summary={summary} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* Trust strip */}
      <section className="mt-6 border-t border-border bg-muted/50 md:mt-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 md:flex-row md:items-center md:gap-6 md:px-6">
          <p className="text-sm font-medium text-ink">
            Facts are sourced, dated and labelled.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge variant="official" />
            <SourceBadge variant="estimated" />
            <SourceBadge variant="analysis" />
          </div>
          <Link
            href="/upcoming"
            className="text-sm font-medium hover:underline md:ml-auto"
          >
            See what&rsquo;s coming →
          </Link>
        </div>
      </section>
    </div>
  );
}
