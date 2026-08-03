import { cache } from "react";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../convex/_generated/api";

export const getProjectDetails = cache(async (slug: string) =>
  fetchQuery(api.projects.getBySlug, { slug }),
);
