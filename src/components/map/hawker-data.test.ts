import { describe, expect, it } from "vitest";

import { parseHawkerDataset } from "./hawker-data";

const DATASET = {
  schemaVersion: 1,
  category: "hawker",
  dataset: {
    id: "nea-hawkers",
    publisher: "National Environment Agency",
    sourceUrl: "https://data.gov.sg/example",
    retrievedAt: "2026-08-04T00:00:00.000Z",
  },
  items: [
    {
      id: "1",
      name: "Example Food Centre",
      status: "current",
      sourceStatus: "Existing",
      lat: 1.3,
      lng: 103.8,
      geometryAccuracy: "exact",
      geometryRole: "site",
    },
  ],
};

describe("hawker dataset", () => {
  it("accepts the reviewed NEA contract", () => {
    expect(parseHawkerDataset(DATASET).items).toHaveLength(1);
  });

  it("drops invalid point rows without hiding valid rows", () => {
    const parsed = parseHawkerDataset({
      ...DATASET,
      items: [...DATASET.items, { id: "broken", lat: "north" }],
    });
    expect(parsed.items.map((item) => item.id)).toEqual(["1"]);
  });

  it("rejects an unreviewed dataset shape", () => {
    expect(() =>
      parseHawkerDataset({ ...DATASET, schemaVersion: 2 }),
    ).toThrow(/unsupported format/);
  });
});
