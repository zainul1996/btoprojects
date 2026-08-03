"use client";

import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker, config as maplibreConfig } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { MAP_WORKER_URL } from "@/lib/map";

// Serve the worker from /public — the default import.meta.url derivation 404s under Turbopack.
maplibreConfig.WORKER_URL = MAP_WORKER_URL;

/**
 * Static locator map — one navy marker, no interaction (DESIGN.md: motion is
 * purposeful; the full explorer carries the interactive map). Positron light
 * basemap keeps the site polygon/marker as the dominant layer.
 */
export function ProjectMiniMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Placeholder 0,0 (ingestion shell awaiting geocode) → render nothing.
  // Kept after the hooks so hook order never changes between renders.
  const hasCoords = Math.abs(lat) >= 0.01 || Math.abs(lng) >= 0.01;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MaplibreMap({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [lng, lat],
      zoom: 14,
      interactive: false,
      attributionControl: { compact: true },
    });
    new Marker({ color: "#22324a" }) // --navy token
      .setLngLat([lng, lat])
      .addTo(map);

    return () => {
      map.remove();
    };
  }, [lat, lng]);

  if (!hasCoords) return null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Map showing the approximate location of ${label}`}
      className="h-[280px] w-full overflow-hidden rounded-xl border border-border/60"
    />
  );
}
