import { describe, expect, it } from "vitest";

import {
  activeMapLayerCount,
  DEFAULT_MAP_LAYER_PREFERENCES,
  parseMapLayerPreferences,
} from "./map-layer-model";

describe("map layer preferences", () => {
  it("defaults MRT to visible", () => {
    expect(parseMapLayerPreferences(null)).toEqual(
      DEFAULT_MAP_LAYER_PREFERENCES,
    );
  });

  it("restores a saved MRT choice", () => {
    expect(
      parseMapLayerPreferences(
        '{"mrt":false,"hawker":true,"parks":true,"primarySchools":true}',
      ),
    ).toEqual({
      mrt: false,
      hawker: true,
      parks: true,
      primarySchools: true,
    });
  });

  it("keeps saved v1 MRT preferences compatible", () => {
    expect(parseMapLayerPreferences('{"mrt":false}')).toEqual({
      mrt: false,
      hawker: false,
      parks: false,
      primarySchools: false,
    });
  });

  it("ignores malformed and stale values", () => {
    expect(parseMapLayerPreferences("not-json")).toEqual(
      DEFAULT_MAP_LAYER_PREFERENCES,
    );
    expect(parseMapLayerPreferences('{"trains":true}')).toEqual(
      DEFAULT_MAP_LAYER_PREFERENCES,
    );
  });

  it("counts only optional overlays", () => {
    expect(
      activeMapLayerCount({
        mrt: true,
        hawker: true,
        parks: true,
        primarySchools: true,
      }),
    ).toBe(4);
    expect(
      activeMapLayerCount({
        mrt: false,
        hawker: false,
        parks: false,
        primarySchools: false,
      }),
    ).toBe(0);
  });
});
