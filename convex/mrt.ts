import { v } from "convex/values";
import { query } from "./_generated/server";
import { haversineKm } from "./lib/geo";
import { mrtStationValidator, projectValidator } from "./lib/validators";

const MAX_CATCHMENT_KM = 2;

export const list = query({
  args: {},
  returns: v.array(mrtStationValidator),
  handler: async (ctx) => {
    return await ctx.db.query("mrtStations").collect();
  },
});

export const projectsNear = query({
  args: { code: v.string() },
  returns: v.array(
    v.object({
      project: projectValidator,
      distanceKm: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const station = await ctx.db
      .query("mrtStations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!station) return [];

    // Projects set is tiny (dozens of rows), so a full scan + haversine in
    // TypeScript beats maintaining a geo index for the MVP.
    const projects = await ctx.db.query("projects").collect();
    return projects
      .map((project) => ({
        project,
        distanceKm:
          Math.round(
            haversineKm(station.lat, station.lng, project.lat, project.lng) *
              100,
          ) / 100,
      }))
      .filter((entry) => entry.distanceKm <= MAX_CATCHMENT_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  },
});
