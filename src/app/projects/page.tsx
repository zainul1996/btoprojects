import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { ProjectCard, type ProjectSummary } from "@/components/project-card";
import { exerciseStatusLabel } from "@/components/project/utils";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  metadataBase: new URL("https://btoprojects.sg"),
  title: "All BTO projects | BTOProjects.sg",
  description:
    "Every HDB BTO project we track, grouped by launch exercise: official prices, flat mix, waiting times and a full source trail on every page.",
  alternates: { canonical: "/projects" },
  openGraph: {
    title: "All BTO projects | BTOProjects.sg",
    description:
      "Every HDB BTO project we track, grouped by launch exercise, with provenance on every fact.",
    url: "/projects",
    type: "website",
  },
};

export default async function ProjectsPage() {
  const [summaries, exerciseRows] = await Promise.all([
    fetchQuery(api.projects.list, {}),
    fetchQuery(api.exercises.list, {}),
  ]);

  const byExercise = new Map<string, ProjectSummary[]>();
  for (const summary of summaries) {
    const key = summary.project.exerciseId;
    const group = byExercise.get(key);
    if (group) {
      group.push(summary);
    } else {
      byExercise.set(key, [summary]);
    }
  }

  // Newest exercise first; skip exercises with no tracked projects.
  const sections = exerciseRows
    .map(({ exercise }) => ({
      exercise,
      projects: byExercise.get(exercise._id) ?? [],
    }))
    .filter((section) => section.projects.length > 0)
    .sort((a, b) => b.exercise.key.localeCompare(a.exercise.key));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
      <PageHeader
        title="All projects"
        lede="Every BTO project we track, grouped by launch exercise. Each page carries its official facts, estimates and a full source trail."
      />

      {sections.map(({ exercise, projects }) => (
        <Section
          key={exercise._id}
          title={exercise.label}
          description={`${projects.length} project${projects.length === 1 ? "" : "s"} in this exercise.`}
        >
          <div className="flex items-center gap-3">
            <Badge variant={exercise.status === "open" ? "default" : "secondary"}>
              {exerciseStatusLabel(exercise.status)}
            </Badge>
            <Link
              href={`/bto/${exercise.key}`}
              className="text-sm text-teal-deep hover:underline"
            >
              View exercise
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((summary) => (
              <ProjectCard key={summary.project._id} summary={summary} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
