/**
 * Basemap: OpenFreeMap "positron" — free, keyless, light.
 * Dev choice pending the D3 basemap decision; swap MAP_STYLE_URL to change.
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron"

/** Singapore island centre, [lng, lat]. */
export const SG_CENTER: [number, number] = [103.8198, 1.3521]

/** Max bounds: [[west, south], [east, north]]. */
export const SG_BOUNDS: [[number, number], [number, number]] = [
  [103.6, 1.22],
  [104.05, 1.47],
]
