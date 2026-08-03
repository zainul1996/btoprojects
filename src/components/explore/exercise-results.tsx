import Link from "next/link";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import {
  effectiveExerciseStatus,
  todayIso,
} from "@/components/explore/filter-model";
import { ProjectCard, type ProjectSummary } from "@/components/project-card";
import { exerciseStatusLabel } from "@/components/project/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type ExerciseRows = FunctionReturnType<typeof api.exercises.list>;

export function ExerciseResults({
  summaries,
  exerciseRows,
}: {
  summaries: ProjectSummary[];
  exerciseRows: ExerciseRows | undefined;
}) {
  if (exerciseRows === undefined) {
    return (
      <div className="space-y-8 p-4 md:p-6" aria-busy="true">
        <p className="sr-only" role="status">
          Loading projects grouped by exercise
        </p>
        <div className="space-y-8" aria-hidden>
          {[0, 1].map((key) => (
            <div key={key} className="space-y-4">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-44 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const byExercise = new Map<string, ProjectSummary[]>();
  for (const summary of summaries) {
    const group = byExercise.get(summary.project.exerciseId);
    if (group) group.push(summary);
    else byExercise.set(summary.project.exerciseId, [summary]);
  }

  const sections = exerciseRows
    .map(({ exercise }) => ({
      exercise,
      projects: byExercise.get(exercise._id) ?? [],
    }))
    .filter(({ projects }) => projects.length > 0)
    .sort((a, b) => b.exercise.key.localeCompare(a.exercise.key));
  const today = todayIso();

  return (
    <div className="mx-auto w-full max-w-6xl divide-y divide-border px-4 pb-10 md:px-6">
      {sections.map(({ exercise, projects }) => {
        const isSbf = exercise.type === "sbf";
        const effectiveStatus = effectiveExerciseStatus(exercise, today);
        return (
          <section
            key={exercise._id}
            className="space-y-4 py-6 md:space-y-5 md:py-8"
            aria-labelledby={`exercise-${exercise._id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 id={`exercise-${exercise._id}`}>{exercise.label}</h2>
                <p className="text-sm text-muted-foreground">
                  {projects.length}{" "}
                  {isSbf
                    ? `town pool${projects.length === 1 ? "" : "s"}`
                    : `project${projects.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={effectiveStatus === "open" ? "default" : "secondary"}
                >
                  {exerciseStatusLabel(effectiveStatus)}
                </Badge>
                <Link
                  href={`/${isSbf ? "sbf" : "bto"}/${exercise.key}`}
                  className="text-sm font-medium text-teal-deep underline-offset-4 hover:underline"
                >
                  View exercise
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((summary) => (
                <ProjectCard key={summary.project._id} summary={summary} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
