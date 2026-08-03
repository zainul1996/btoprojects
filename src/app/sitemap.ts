import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../convex/_generated/api";
import { townHref } from "@/components/project/utils";
import { absoluteUrl } from "@/lib/seo";

// Exercise and project lists change on HDB's schedule, not ours; never
// prerender a stale snapshot at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/explore",
    "/upcoming",
    "/compare",
    "/planner",
    "/methodology",
  ].map((path) => ({
    url: absoluteUrl(path || "/"),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  const [exerciseResult, projectResult] = await Promise.allSettled([
    fetchQuery(api.exercises.list, {}),
    fetchQuery(api.projects.list, {}),
  ]);
  const exerciseRows =
    exerciseResult.status === "fulfilled" ? exerciseResult.value : [];
  const projects =
    projectResult.status === "fulfilled" ? projectResult.value : [];

  // One route per exercise with real supply: BTO exercises at /bto/[key],
  // SBF exercises at /sbf/[key]. Upcoming exercises without projects land
  // the day composition is published.
  const exerciseRoutes: MetadataRoute.Sitemap = exerciseRows
    .filter(({ projectCount }) => projectCount > 0)
    .map(({ exercise }) => ({
      url: absoluteUrl(
        `${exercise.type === "sbf" ? "/sbf" : "/bto"}/${exercise.key}`,
      ),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const projectRoutes: MetadataRoute.Sitemap = projects.map(({ project }) => ({
    url: absoluteUrl(`/projects/${project.slug}`),
    lastModified: new Date(project.updatedAt),
    changeFrequency: "weekly",
    priority: 0.6,
    images: [absoluteUrl(`/projects/${project.slug}/opengraph-image`)],
  }));

  const townRoutes: MetadataRoute.Sitemap = [
    ...new Set(
      projects
        .map(({ town }) => town?.name)
        .filter((name): name is string => name !== undefined),
    ),
  ].map((name) => ({
    url: absoluteUrl(townHref(name)),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...exerciseRoutes, ...townRoutes, ...projectRoutes];
}
