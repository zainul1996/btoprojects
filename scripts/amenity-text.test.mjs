import { describe, expect, it } from "vitest";

import { toAmenityDisplayName } from "./amenity-text.mjs";

describe("amenity display names", () => {
  it("keeps possessive s lowercase", () => {
    expect(toAmenityDisplayName("ST ANDREW'S PRIMARY SCHOOL")).toBe(
      "St Andrew's Primary School",
    );
  });

  it("preserves familiar Singapore names", () => {
    expect(toAmenityDisplayName("CHIJ PRIMARY (TOA PAYOH)")).toBe(
      "CHIJ Primary (Toa Payoh)",
    );
    expect(toAmenityDisplayName("HORTPARK")).toBe("HortPark");
  });
});
