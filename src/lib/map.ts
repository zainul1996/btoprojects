/**
 * Basemap: OpenFreeMap "positron" — free, keyless, light.
 * Dev choice pending the D3 basemap decision; swap MAP_STYLE_URL to change.
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron"

/**
 * Same-origin copy of the MapLibre worker, vendored into /public by
 * scripts/sync-maplibre-worker.mjs. MapLibre v6 otherwise derives the worker
 * URL from `import.meta.url`, which under Turbopack points into
 * /_next/static/chunks/ and 404s — the browser then rejects the HTML error
 * page as a module worker and the map never initialises.
 */
export const MAP_WORKER_URL = "/maplibre-gl-worker.mjs"

/** Singapore island centre, [lng, lat]. */
export const SG_CENTER: [number, number] = [103.8198, 1.3521]

/** Max bounds: [[west, south], [east, north]]. */
export const SG_BOUNDS: [[number, number], [number, number]] = [
  [103.6, 1.22],
  [104.05, 1.47],
]
