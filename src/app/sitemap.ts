import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../convex/_generated/api";
import { townHref } from "@/components/project/utils";

// Exercise and project lists change on HDB's schedule, not ours; never
// prerender a stale snapshot at build time.
export const dynamic = "force-dynamic";

const BASE_URL = "https://btoprojects.sg";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/explore",
    "/upcoming",
    "/projects",
    "/compare",
    "/planner",
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  // One route per exercise with real supply: BTO exercises at /bto/[key],
  // SBF exercises at /sbf/[key]. Upcoming exercises without projects land
  // the day composition is published.
  const exerciseRows = await fetchQuery(api.exercises.list, {});
  const exerciseRoutes: MetadataRoute.Sitemap = exerciseRows
    .filter(({ projectCount }) => projectCount > 0)
    .map(({ exercise }) => ({
      url: `${BASE_URL}${exercise.type === "sbf" ? "/sbf" : "/bto"}/${exercise.key}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const projects = await fetchQuery(api.projects.list, {});
  const projectRoutes: MetadataRoute.Sitemap = projects.map(({ project }) => ({
    url: `${BASE_URL}/projects/${project.slug}`,
    lastModified: new Date(project.updatedAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const townRoutes: MetadataRoute.Sitemap = [
    ...new Set(
      projects
        .map(({ town }) => town?.name)
        .filter((name): name is string => name !== undefined),
    ),
  ].map((name) => ({
    url: `${BASE_URL}${townHref(name)}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...exerciseRoutes, ...townRoutes, ...projectRoutes];
}
