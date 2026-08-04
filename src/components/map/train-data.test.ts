import { describe, expect, it } from "vitest";

import { parseTrainStationDataset } from "./train-data";

const DATASET = {
  schemaVersion: 1,
  category: "train_station",
  dataset: {
    id: "lta-trains",
    publisher: "Land Transport Authority",
    sourceUrl: "https://datamall.lta.gov.sg/example",
    retrievedAt: "2026-08-04T00:00:00.000Z",
  },
  coverage: {
    stationExits: 2,
    stations: 1,
    mrt: 1,
    lrt: 0,
    skippedCodeOnly: 0,
    curatedCodeMatches: 1,
  },
  items: [
    {
      id: "EW1",
      name: "Pasir Ris",
      officialName: "Pasir Ris MRT Station",
      mode: "mrt",
      code: "EW1",
      line: "East-West",
      lat: 1.373,
      lng: 103.949,
      geometryAccuracy: "approximate",
      geometryRole: "centroid",
      exitCount: 2,
    },
  ],
};

describe("train station dataset", () => {
  it("accepts the reviewed LTA contract", () => {
    expect(parseTrainStationDataset(DATASET).items[0]?.code).toBe("EW1");
  });

  it("drops invalid station rows", () => {
    const parsed = parseTrainStationDataset({
      ...DATASET,
      items: [...DATASET.items, { id: "broken", mode: "unknown" }],
    });
    expect(parsed.items).toHaveLength(1);
  });

  it("rejects incomplete coverage metadata", () => {
    expect(() =>
      parseTrainStationDataset({ ...DATASET, coverage: { stations: 1 } }),
    ).toThrow(/coverage summary/);
  });
});
