import { v } from "convex/values";
import { query } from "./_generated/server";
import { exerciseValidator } from "./lib/validators";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      exercise: exerciseValidator,
      projectCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const exercises = await ctx.db.query("exercises").collect();
    return await Promise.all(
      exercises.map(async (exercise) => ({
        exercise,
        projectCount: (
          await ctx.db
            .query("projects")
            .withIndex("by_exercise", (q) => q.eq("exerciseId", exercise._id))
            .collect()
        ).length,
      })),
    );
  },
});
