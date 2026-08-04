import { describe, expect, it } from "vitest";

import { parsePrimarySchoolDataset } from "./school-data";

const DATASET = {
  schemaVersion: 1,
  category: "primary_school",
  dataset: {
    id: "moe-schools",
    name: "School Directory and Information",
    publisher: "Ministry of Education",
    sourceUrl: "https://data.gov.sg/example",
    retrievedAt: "2026-08-04T00:00:00.000Z",
  },
  geocoder: {
    name: "OneMap Search",
    publisher: "Singapore Land Authority",
    sourceUrl: "https://www.onemap.gov.sg/apidocs/search",
    retrievedAt: "2026-08-04T00:00:00.000Z",
  },
  coverage: {
    sourceRows: 1,
    eligiblePrimaryRows: 1,
    schools: 1,
    skipped: 0,
    invalidIdentity: 0,
    invalidAddress: 0,
    noGeocode: 0,
    ambiguousGeocode: 0,
  },
  items: [
    {
      id: "123456",
      name: "Example Primary School",
      officialName: "EXAMPLE PRIMARY SCHOOL",
      address: "1 EXAMPLE ROAD",
      postalCode: "123456",
      schoolLevel: "primary",
      lat: 1.3,
      lng: 103.8,
      geometryAccuracy: "approximate",
      geometryRole: "site",
      matchMethod: "postal_exact",
      matchedPointCount: 1,
    },
  ],
};

describe("primary school dataset", () => {
  it("accepts the reviewed MOE and OneMap contract", () => {
    expect(parsePrimarySchoolDataset(DATASET).items).toHaveLength(1);
  });

  it("drops invalid geocodes without hiding valid rows", () => {
    const parsed = parsePrimarySchoolDataset({
      ...DATASET,
      items: [...DATASET.items, { id: "broken", lat: "north" }],
    });
    expect(parsed.items.map((item) => item.id)).toEqual(["123456"]);
  });

  it("rejects unreviewed geometry claims", () => {
    expect(() =>
      parsePrimarySchoolDataset({ ...DATASET, schemaVersion: 2 }),
    ).toThrow(/unsupported format/);
  });

  it("requires the ambiguous geocode count", () => {
    const coverage = Object.fromEntries(
      Object.entries(DATASET.coverage).filter(
        ([key]) => key !== "ambiguousGeocode",
      ),
    );
    expect(() => parsePrimarySchoolDataset({ ...DATASET, coverage })).toThrow(
      /coverage summary/,
    );
  });
});
