import { describe, expect, it } from "vitest";

import {
  enrichLocationPreferences,
  isSingaporeCoordinate,
  normalizeProfileInput,
} from "../../convex/lib/profilePreferences";
import { rankProjects } from "../../convex/lib/ranking";
import { constraintsFromProfile } from "./planner/profile-seed";
import { projectPreferenceDistances } from "./profile-distance";

const workplace = {
  label: "Workplace 1",
  address: "ONE RAFFLES PLACE, 1 RAFFLES PLACE SINGAPORE 048616",
  lat: 1.2841,
  lng: 103.851,
};

describe("profile preference normalization", () => {
  it("trims and deduplicates bounded string lists", () => {
    expect(
      normalizeProfileInput({
        budgetMax: 550_000,
        waitToleranceMonths: 48,
        flatTypes: ["4-room", "4-room"],
        towns: [" Tampines ", "tampines", "Bedok"],
        regions: ["East", "East"],
        workplaces: [
          workplace,
          { ...workplace, label: "Workplace 2" },
        ],
      }),
    ).toMatchObject({
      flatTypes: ["4-room"],
      towns: ["Tampines", "Bedok"],
      regions: ["East"],
      workplaces: [workplace],
    });
  });

  it("rejects unreasonable values and unknown regions", () => {
    expect(() =>
      normalizeProfileInput({
        budgetMax: 10,
        flatTypes: [],
        regions: ["Somewhere"],
        workplaces: [],
      }),
    ).toThrow(/Budget/);
    expect(() =>
      normalizeProfileInput({
        flatTypes: [],
        regions: ["Somewhere"],
        workplaces: [],
      }),
    ).toThrow(/region/);
  });
});

describe("planner profile geo enrichment", () => {
  it("adds coordinates only for an exact alias match", () => {
    const result = enrichLocationPreferences(
      {
        workplaces: [
          { label: "Workplace 1" },
          { label: "Unsaved office" },
        ],
      },
      {
        workplaces: [
          { label: workplace.label, lat: workplace.lat, lng: workplace.lng },
        ],
      },
    );
    expect(result.workplaces?.[0]).toEqual({
      label: "Workplace 1",
      lat: workplace.lat,
      lng: workplace.lng,
    });
    expect(result.workplaces?.[1]).toEqual({ label: "Unsaved office" });
  });

  it("seeds aliases without saved addresses", () => {
    const constraints = constraintsFromProfile({
      budgetMax: 550_000,
      flatTypes: ["4-room"],
      workplaceCount: 1,
      hasParentsArea: true,
    });
    expect(constraints?.workplaces).toEqual(["Workplace 1"]);
    expect(constraints?.parentsArea).toBe("Parents’ area");
    expect(JSON.stringify(constraints)).not.toContain("RAFFLES");
    expect(JSON.stringify(constraints)).not.toContain("EXAMPLE STREET");
  });
});

describe("project saved-place distance presentation", () => {
  it("formats straight-line distances for valid BTO coordinates", () => {
    const result = projectPreferenceDistances({
      saleType: "bto",
      projectLat: 1.35,
      projectLng: 103.82,
      workplaces: [workplace],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toMatch(/^(Under 1 km|About \d+ km)$/);
    expect(result[0]?.label).toBe(workplace.address);
  });

  it("suppresses SBF centroids and unknown coordinates", () => {
    expect(
      projectPreferenceDistances({
        saleType: "sbf",
        projectLat: 1.35,
        projectLng: 103.82,
        workplaces: [workplace],
      }),
    ).toEqual([]);
    expect(
      projectPreferenceDistances({
        saleType: "bto",
        projectLat: 0,
        projectLng: 0,
        workplaces: [workplace],
      }),
    ).toEqual([]);
    expect(isSingaporeCoordinate(1.35, 103.82)).toBe(true);
    expect(isSingaporeCoordinate(51.5, -0.1)).toBe(false);
  });
});

describe("ranking invalid project coordinates", () => {
  it("does not calculate personal distance for coordinates outside Singapore", () => {
    const [ranked] = rankProjects(
      [
        {
          slug: "invalid-location",
          name: "Invalid location",
          town: "Bedok",
          region: "East",
          classification: "Standard",
          lifecycleStatus: "launched",
          estimatedWaitMonths: 36,
          estimatedCompletion: "2029-01",
          lat: 51.5,
          lng: -0.1,
          mrtWalkingMinutes: 10,
          flatTypes: [
            {
              type: "4-room",
              units: 100,
              minPrice: 400_000,
              maxPrice: 500_000,
            },
          ],
        },
      ],
      {
        workplaces: [
          {
            label: "Workplace 1",
            lat: workplace.lat,
            lng: workplace.lng,
          },
        ],
      },
    );
    expect(ranked?.breakdown.locationFit.score).toBe(50);
    expect(ranked?.breakdown.locationFit.reasons.join(" ")).toContain(
      "coordinates are not reliable",
    );
  });

  it("balances distance across both saved workplaces", () => {
    const project = {
      slug: "balanced-location",
      name: "Balanced location",
      town: "Bedok",
      region: "East",
      classification: "Standard" as const,
      lifecycleStatus: "launched",
      estimatedWaitMonths: 36,
      estimatedCompletion: "2029-01",
      lat: 1.35,
      lng: 103.82,
      mrtWalkingMinutes: 10,
      flatTypes: [
        {
          type: "4-room",
          units: 100,
          minPrice: 400_000,
          maxPrice: 500_000,
        },
      ],
    };
    const nearOnly = rankProjects([project], {
      workplaces: [
        { label: "Workplace 1", lat: 1.351, lng: 103.821 },
      ],
    })[0]!;
    const balanced = rankProjects([project], {
      workplaces: [
        { label: "Workplace 1", lat: 1.351, lng: 103.821 },
        { label: "Workplace 2", lat: 1.28, lng: 103.86 },
      ],
    })[0]!;

    expect(balanced.breakdown.locationFit.score).toBeLessThan(
      nearOnly.breakdown.locationFit.score,
    );
    expect(balanced.breakdown.locationFit.reasons.join(" ")).toContain(
      "Workplace 1",
    );
    expect(balanced.breakdown.locationFit.reasons.join(" ")).toContain(
      "Workplace 2",
    );
    expect(balanced.breakdown.locationFit.reasons.join(" ")).not.toContain(
      "travel time estimate",
    );
  });
});
