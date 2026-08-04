export const MAP_LAYER_PREFERENCES_KEY = "btoprojects.map-layers.v1";

export type MapLayerPreferences = {
  mrt: boolean;
  hawker: boolean;
  parks: boolean;
  primarySchools: boolean;
};

export const DEFAULT_MAP_LAYER_PREFERENCES: MapLayerPreferences = {
  mrt: true,
  hawker: false,
  parks: false,
  primarySchools: false,
};

export function parseMapLayerPreferences(
  value: string | null,
): MapLayerPreferences {
  if (!value) return DEFAULT_MAP_LAYER_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "mrt" in parsed &&
      typeof parsed.mrt === "boolean"
    ) {
      return {
        mrt: parsed.mrt,
        hawker:
          "hawker" in parsed && typeof parsed.hawker === "boolean"
            ? parsed.hawker
            : false,
        parks:
          "parks" in parsed && typeof parsed.parks === "boolean"
            ? parsed.parks
            : false,
        primarySchools:
          "primarySchools" in parsed &&
          typeof parsed.primarySchools === "boolean"
            ? parsed.primarySchools
            : false,
      };
    }
  } catch {
    // Invalid or older preferences safely fall back to the current defaults.
  }

  return DEFAULT_MAP_LAYER_PREFERENCES;
}

export function activeMapLayerCount(preferences: MapLayerPreferences): number {
  return (
    Number(preferences.mrt) +
    Number(preferences.hawker) +
    Number(preferences.parks) +
    Number(preferences.primarySchools)
  );
}
