import { describe, expect, it } from "vitest";

import { parseParkDataset } from "./park-data";

const DATASET = {
  schemaVersion: 1,
  category: "park",
  dataset: {
    id: "nparks-managed-areas",
    name: "NParks Parks and Nature Reserves",
    publisher: "National Parks Board",
    sourceUrl: "https://data.gov.sg/example",
    retrievedAt: "2026-08-04T00:00:00.000Z",
    sourceLastUpdatedAt: "2026-06-30T00:00:00+08:00",
  },
  coverage: {
    sourceFeatures: 1,
    parks: 1,
    skipped: 0,
    invalidIdentity: 0,
    invalidGeometry: 0,
  },
  items: [
    {
      id: "1",
      name: "Example Park",
      officialName: "EXAMPLE PARK",
      lat: 1.3,
      lng: 103.8,
      geometryAccuracy: "approximate",
      geometryRole: "centroid",
      sourceGeometryType: "Polygon",
    },
  ],
};

describe("park dataset", () => {
  it("accepts the reviewed NParks contract", () => {
    expect(parseParkDataset(DATASET).items).toHaveLength(1);
  });

  it("drops invalid point rows without hiding valid rows", () => {
    const parsed = parseParkDataset({
      ...DATASET,
      items: [...DATASET.items, { id: "broken", lat: "north" }],
    });
    expect(parsed.items.map((item) => item.id)).toEqual(["1"]);
  });

  it("rejects incomplete coverage metadata", () => {
    expect(() =>
      parseParkDataset({ ...DATASET, coverage: { parks: 1 } }),
    ).toThrow(/coverage summary/);
  });
});
