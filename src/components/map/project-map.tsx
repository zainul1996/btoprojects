"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./project-map.css";

import { formatSgd } from "@/components/price";
import { MAP_STYLE_URL, MAP_WORKER_URL, SG_BOUNDS, SG_CENTER } from "@/lib/map";
import { cn } from "@/lib/utils";

// Serve the worker from /public — the default import.meta.url derivation 404s under Turbopack.
maplibregl.config.WORKER_URL = MAP_WORKER_URL;

export type ProjectMapItem = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  fromPrice?: number | null;
  townName?: string;
  /** Extra meta line content, appended after town · price when set. */
  extra?: string;
};

type ProjectMapProps = {
  projects: ProjectMapItem[];
  focusedSlug?: string | null;
  onMarkerClick?: (slug: string) => void;
  className?: string;
  /** Initial zoom only — the map owns zoom after mount. */
  zoom?: number;
};

/**
 * Shared MapLibre wrapper (explorer today, project/town pages next).
 * Client-only: render via `next/dynamic` with `ssr: false`. The map is
 * created once per mount and fully torn down on cleanup, so React strict
 * mode's double-mount and route changes are safe. Markers are diffed by
 * slug — data changes never re-initialise the map.
 */
export function ProjectMap({
  projects,
  focusedSlug = null,
  onMarkerClick,
  className,
  zoom = 11,
}: ProjectMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const projectsRef = useRef<ProjectMapItem[]>(projects);
  const focusedSlugRef = useRef<string | null>(focusedSlug);
  const onMarkerClickRef = useRef<typeof onMarkerClick>(onMarkerClick);
  const fittedIdentityRef = useRef<string | null>(null);
  const initialZoomRef = useRef(zoom);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    focusedSlugRef.current = focusedSlug;
  }, [focusedSlug]);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  function applyFocus() {
    for (const [slug, marker] of markersRef.current) {
      marker.getElement().dataset.focused =
        slug === focusedSlugRef.current ? "true" : "false";
    }
  }

  function buildPopupContent(p: ProjectMapItem): HTMLElement {
    const root = document.createElement("div");

    const name = document.createElement("p");
    name.className = "bto-map-popup__name";
    name.textContent = p.name;
    root.appendChild(name);

    const metaParts: string[] = [];
    if (p.townName) metaParts.push(p.townName);
    if (p.fromPrice != null) metaParts.push(`From ${formatSgd(p.fromPrice)}`);
    if (p.extra) metaParts.push(p.extra);
    if (metaParts.length > 0) {
      const meta = document.createElement("p");
      meta.className = "bto-map-popup__meta";
      meta.textContent = metaParts.join(" · ");
      root.appendChild(meta);
    }

    const link = document.createElement("a");
    link.className = "bto-map-popup__link";
    link.href = `/projects/${p.slug}`;
    link.textContent = "View project →";
    root.appendChild(link);

    return root;
  }

  function openPopup(p: ProjectMapItem) {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({
      className: "bto-map-popup",
      closeButton: true,
      closeOnClick: true,
      maxWidth: "260px",
      offset: 14,
    })
      .setLngLat([p.lng, p.lat])
      .setDOMContent(buildPopupContent(p))
      .addTo(map);
  }

  function createMarker(p: ProjectMapItem): maplibregl.Marker {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bto-map-marker";
    el.dataset.focused = "false";
    el.setAttribute("aria-label", `${p.name} — show on map`);

    const dot = document.createElement("span");
    dot.className = "bto-map-marker__dot";
    dot.setAttribute("aria-hidden", "true");
    el.appendChild(dot);

    el.addEventListener("click", () => {
      openPopup(p);
      onMarkerClickRef.current?.(p.slug);
    });

    return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]);
  }

  function fitToProjects(animate: boolean) {
    const map = mapRef.current;
    const items = projectsRef.current;
    if (!map || items.length === 0) return; // empty set keeps the island view

    const duration = animate ? 500 : 0;
    if (items.length === 1) {
      map.easeTo({
        center: [items[0].lng, items[0].lat],
        zoom: 13,
        duration,
      });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const p of items) bounds.extend([p.lng, p.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration });
  }

  /** Diff markers against the latest project set; refit only when the set identity changes. */
  function syncMarkers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const items = projectsRef.current;
    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const p of items) {
      seen.add(p.slug);
      const existing = markers.get(p.slug);
      if (existing) {
        existing.setLngLat([p.lng, p.lat]);
      } else {
        markers.set(p.slug, createMarker(p).addTo(map));
      }
    }
    for (const [slug, marker] of markers) {
      if (!seen.has(slug)) {
        marker.remove();
        markers.delete(slug);
      }
    }

    const identity = items
      .map((p) => p.slug)
      .sort()
      .join(",");
    if (identity !== fittedIdentityRef.current) {
      const isFirstFit = fittedIdentityRef.current === null;
      fittedIdentityRef.current = identity;
      fitToProjects(!isFirstFit);
    }

    applyFocus();
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      center: SG_CENTER,
      zoom: initialZoomRef.current,
      maxBounds: SG_BOUNDS,
      attributionControl: { compact: true },
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    mapRef.current = map;
    const markers = markersRef.current;

    const onLoad = () => {
      readyRef.current = true;
      syncMarkers();
    };
    map.on("load", onLoad);

    return () => {
      map.off("load", onLoad);
      readyRef.current = false;
      fittedIdentityRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once by design; data flows through refs
  }, []);

  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncMarkers reads latest refs
  }, [projects]);

  useEffect(() => {
    applyFocus();
  }, [focusedSlug]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full bg-muted", className)}
      role="application"
      aria-label="Map of BTO projects in Singapore"
    />
  );
}
