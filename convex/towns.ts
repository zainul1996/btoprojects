import { v } from "convex/values";
import { query } from "./_generated/server";
import { projectSummaryValidator, townValidator } from "./lib/validators";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      town: townValidator,
      projectCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const towns = await ctx.db.query("towns").collect();
    const withCounts = await Promise.all(
      towns.map(async (town) => ({
        town,
        projectCount: (
          await ctx.db
            .query("projects")
            .withIndex("by_town", (q) => q.eq("townId", town._id))
            .collect()
        ).length,
      })),
    );
    // Reference towns with no seeded projects are still useful filters,
    // but towns with projects surface first.
    return withCounts.sort((a, b) => b.projectCount - a.projectCount);
  },
});

export const getByName = query({
  args: { name: v.string() },
  returns: v.object({
    town: v.union(townValidator, v.null()),
    projects: v.array(projectSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const town = await ctx.db
      .query("towns")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (!town) return { town: null, projects: [] };

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_town", (q) => q.eq("townId", town._id))
      .collect();

    return {
      town,
      projects: await Promise.all(
        projects.map(async (project) => {
          const [flatTypes, exercise] = await Promise.all([
            ctx.db
              .query("flatTypes")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect(),
            ctx.db.get("exercises", project.exerciseId),
          ]);
          return {
            project,
            town,
            flatTypes,
            exerciseLabel: exercise?.label ?? null,
          };
        }),
      ),
    };
  },
});
