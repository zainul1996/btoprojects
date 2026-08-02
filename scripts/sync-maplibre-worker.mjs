/**
 * Vendors the MapLibre GL JS web worker into /public.
 *
 * MapLibre v6 derives its worker URL at runtime from `import.meta.url`.
 * Turbopack serves the bundled module from /_next/static/chunks/, so the
 * derived `.../chunks/maplibre-gl-worker.mjs` URL 404s and the browser
 * rejects the HTML response as a module worker. We serve the worker (and
 * the shared chunk it statically imports) as same-origin static files and
 * point `maplibregl.config.WORKER_URL` at them (see src/lib/map.ts).
 *
 * Runs automatically via the `predev` and `prebuild` npm hooks so the copy
 * always matches the installed maplibre-gl version.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const maplibreDist = dirname(require.resolve("maplibre-gl/package.json"));
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

const outDir = join(root, "public");
mkdirSync(outDir, { recursive: true });

for (const file of files) {
  copyFileSync(join(maplibreDist, "dist", file), join(outDir, file));
  console.log(`synced public/${file}`);
}
