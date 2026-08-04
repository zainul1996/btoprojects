"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./project-map.css";

import type { HawkerCentre } from "@/components/map/hawker-data";
import {
  AmenityMapSymbol,
  createAmenityMapSymbol,
} from "@/components/map/map-amenity-symbol";
import type { Park } from "@/components/map/park-data";
import type { PrimarySchool } from "@/components/map/school-data";
import type { TrainStation } from "@/components/map/train-data";
import {
  MAP_STYLE_URL,
  MAP_WORKER_URL,
  SG_BOUNDS,
  SG_CENTER,
  SG_MIN_ZOOM,
} from "@/lib/map";
import { cn } from "@/lib/utils";

// Serve the worker from /public — the default import.meta.url derivation 404s under Turbopack.
maplibregl.config.WORKER_URL = MAP_WORKER_URL;

const PRIMARY_SCHOOL_MIN_ZOOM = 11.2;
const PARK_MIN_ZOOM = 11.6;
const MRT_MIN_ZOOM = 10;
const HAWKER_MIN_ZOOM = 10.6;

export type ProjectMapItem = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  /**
   * "announced" projects render as a soft area halo, not a point pin — the
   * coordinates are MRT-anchored approximations until HDB publishes the
   * exact site at launch.
   */
  lifecycleStatus?: string;
  /**
   * "sbf" rows are town pools sold by town and flat type, not single sites.
   * They render as a teal dashed-ring area marker at the town centroid,
   * distinct from the navy announced halo.
   */
  saleType?: "bto" | "sbf";
  totalUnits?: number;
  /** Short exercise label (e.g. "Feb 2026"), shown for SBF pools. */
  exerciseLabel?: string | null;
  fromPrice?: number | null;
  townName?: string;
  /** Extra meta line content, appended after town · price when set. */
  extra?: string;
};

export type MrtMapItem = TrainStation;

export type HawkerMapItem = HawkerCentre;

export type ParkMapItem = Park;

export type PrimarySchoolMapItem = PrimarySchool;

/**
 * Ingestion-created shell projects carry placeholder 0,0 coordinates until
 * the geocoder runs — never draw those markers (0,0 sits in the ocean off
 * Africa) or let them drag bounds fitting away from Singapore.
 */
function hasRealCoords(p: { lat: number; lng: number }): boolean {
  return Math.abs(p.lat) >= 0.01 || Math.abs(p.lng) >= 0.01;
}

type ProjectMapProps = {
  projects: ProjectMapItem[];
  mrtStations?: MrtMapItem[];
  showMrtStations?: boolean;
  hawkerCentres?: HawkerMapItem[];
  showHawkerCentres?: boolean;
  parks?: ParkMapItem[];
  showParks?: boolean;
  primarySchools?: PrimarySchoolMapItem[];
  showPrimarySchools?: boolean;
  focusedSlug?: string | null;
  onMarkerClick?: (slug: string) => void;
  onSelectionClear?: () => void;
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
  mrtStations = [],
  showMrtStations = true,
  hawkerCentres = [],
  showHawkerCentres = false,
  parks = [],
  showParks = false,
  primarySchools = [],
  showPrimarySchools = false,
  focusedSlug = null,
  onMarkerClick,
  onSelectionClear,
  className,
  zoom = 11,
}: ProjectMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const mrtMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const hawkerMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const parkMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const schoolMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupSlugRef = useRef<string | null>(null);
  const projectsRef = useRef<ProjectMapItem[]>(projects.filter(hasRealCoords));
  const mrtStationsRef = useRef<MrtMapItem[]>(
    mrtStations.filter(hasRealCoords),
  );
  const showMrtStationsRef = useRef(showMrtStations);
  const hawkerCentresRef = useRef<HawkerMapItem[]>(
    hawkerCentres.filter(hasRealCoords),
  );
  const showHawkerCentresRef = useRef(showHawkerCentres);
  const parksRef = useRef<ParkMapItem[]>(parks.filter(hasRealCoords));
  const showParksRef = useRef(showParks);
  const primarySchoolsRef = useRef<PrimarySchoolMapItem[]>(
    primarySchools.filter(hasRealCoords),
  );
  const showPrimarySchoolsRef = useRef(showPrimarySchools);
  const focusedSlugRef = useRef<string | null>(focusedSlug);
  const onMarkerClickRef = useRef<typeof onMarkerClick>(onMarkerClick);
  const onSelectionClearRef = useRef<typeof onSelectionClear>(onSelectionClear);
  const fittedIdentityRef = useRef<string | null>(null);
  const initialZoomRef = useRef(zoom);
  const [mapZoom, setMapZoom] = useState(zoom);

  useEffect(() => {
    projectsRef.current = projects.filter(hasRealCoords);
  }, [projects]);

  useEffect(() => {
    mrtStationsRef.current = mrtStations.filter(hasRealCoords);
  }, [mrtStations]);

  useEffect(() => {
    showMrtStationsRef.current = showMrtStations;
  }, [showMrtStations]);

  useEffect(() => {
    hawkerCentresRef.current = hawkerCentres.filter(hasRealCoords);
  }, [hawkerCentres]);

  useEffect(() => {
    showHawkerCentresRef.current = showHawkerCentres;
  }, [showHawkerCentres]);

  useEffect(() => {
    parksRef.current = parks.filter(hasRealCoords);
  }, [parks]);

  useEffect(() => {
    showParksRef.current = showParks;
  }, [showParks]);

  useEffect(() => {
    primarySchoolsRef.current = primarySchools.filter(hasRealCoords);
  }, [primarySchools]);

  useEffect(() => {
    showPrimarySchoolsRef.current = showPrimarySchools;
  }, [showPrimarySchools]);

  useEffect(() => {
    focusedSlugRef.current = focusedSlug;
  }, [focusedSlug]);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    onSelectionClearRef.current = onSelectionClear;
  }, [onSelectionClear]);

  function applyFocus() {
    for (const [slug, marker] of markersRef.current) {
      marker.getElement().dataset.focused =
        slug === focusedSlugRef.current ? "true" : "false";
    }
  }

  function closePopup(clearProjectSelection: boolean) {
    popupSlugRef.current = null;
    const popup = popupRef.current;
    popupRef.current = null;
    popup?.remove();
    if (clearProjectSelection) onSelectionClearRef.current?.();
  }

  function openMrtPopup(station: MrtMapItem) {
    const map = mapRef.current;
    if (!map) return;
    closePopup(false);
    const popupKey = `mrt:${station.id}`;
    const root = document.createElement("div");
    const name = document.createElement("p");
    name.className = "bto-map-popup__name";
    name.textContent = station.name;
    root.appendChild(name);
    const meta = document.createElement("p");
    meta.className = "bto-map-popup__meta";
    meta.textContent = [
      station.mode === "lrt" ? "LRT" : "MRT",
      station.code,
      station.line,
    ]
      .filter(Boolean)
      .join(" · ");
    root.appendChild(meta);
    const note = document.createElement("p");
    note.className = "bto-map-popup__note";
    note.textContent =
      "Approximate station location based on LTA station exits";
    root.appendChild(note);

    const popup = new maplibregl.Popup({
      className: "bto-map-popup",
      closeButton: true,
      closeOnClick: false,
      maxWidth: "240px",
      offset: 12,
    })
      .setLngLat([station.lng, station.lat])
      .setDOMContent(root)
      .addTo(map);
    popupRef.current = popup;
    popupSlugRef.current = popupKey;
    popup.on("close", () => {
      if (popupSlugRef.current !== popupKey) return;
      popupRef.current = null;
      popupSlugRef.current = null;
    });
  }

  function openHawkerPopup(centre: HawkerMapItem) {
    const map = mapRef.current;
    if (!map) return;
    closePopup(false);
    const popupKey = `hawker:${centre.id}`;
    const root = document.createElement("div");
    const name = document.createElement("p");
    name.className = "bto-map-popup__name";
    name.textContent = centre.name;
    root.appendChild(name);
    const meta = document.createElement("p");
    meta.className = "bto-map-popup__meta";
    const metaParts = [centre.status === "planned" ? "Planned" : "Current"];
    if (centre.address) metaParts.push(centre.address);
    if (centre.cookedFoodStalls) {
      metaParts.push(`${centre.cookedFoodStalls} cooked-food stalls`);
    }
    meta.textContent = metaParts.join(" · ");
    root.appendChild(meta);

    const source = document.createElement("p");
    source.className = "bto-map-popup__note";
    source.textContent = `NEA status: ${centre.sourceStatus}`;
    root.appendChild(source);

    const popup = new maplibregl.Popup({
      className: "bto-map-popup",
      closeButton: true,
      closeOnClick: false,
      maxWidth: "280px",
      offset: 12,
    })
      .setLngLat([centre.lng, centre.lat])
      .setDOMContent(root)
      .addTo(map);
    popupRef.current = popup;
    popupSlugRef.current = popupKey;
    popup.on("close", () => {
      if (popupSlugRef.current !== popupKey) return;
      popupRef.current = null;
      popupSlugRef.current = null;
    });
  }

  function openParkPopup(park: ParkMapItem) {
    const map = mapRef.current;
    if (!map) return;
    closePopup(false);
    const popupKey = `park:${park.id}`;
    const root = document.createElement("div");
    const name = document.createElement("p");
    name.className = "bto-map-popup__name";
    name.textContent = park.name;
    root.appendChild(name);
    const meta = document.createElement("p");
    meta.className = "bto-map-popup__meta";
    meta.textContent = "NParks mapped area";
    root.appendChild(meta);
    const note = document.createElement("p");
    note.className = "bto-map-popup__note";
    note.textContent =
      "Approximate centre of the mapped area, not a park entrance";
    root.appendChild(note);

    const popup = new maplibregl.Popup({
      className: "bto-map-popup",
      closeButton: true,
      closeOnClick: false,
      maxWidth: "260px",
      offset: 12,
    })
      .setLngLat([park.lng, park.lat])
      .setDOMContent(root)
      .addTo(map);
    popupRef.current = popup;
    popupSlugRef.current = popupKey;
    popup.on("close", () => {
      if (popupSlugRef.current !== popupKey) return;
      popupRef.current = null;
      popupSlugRef.current = null;
    });
  }

  function openPrimarySchoolPopup(school: PrimarySchoolMapItem) {
    const map = mapRef.current;
    if (!map) return;
    closePopup(false);
    const popupKey = `school:${school.id}`;
    const root = document.createElement("div");
    const name = document.createElement("p");
    name.className = "bto-map-popup__name";
    name.textContent = school.name;
    root.appendChild(name);
    const meta = document.createElement("p");
    meta.className = "bto-map-popup__meta";
    meta.textContent = `${school.address} · Singapore ${school.postalCode}`;
    root.appendChild(meta);
    if (school.schoolLevel === "mixed_primary_secondary") {
      const level = document.createElement("p");
      level.className = "bto-map-popup__meta";
      level.textContent = "Primary and secondary levels";
      root.appendChild(level);
    }
    const note = document.createElement("p");
    note.className = "bto-map-popup__note";
    note.textContent =
      "Approximate site location from OneMap. Check Primary 1 distance eligibility separately";
    root.appendChild(note);

    const popup = new maplibregl.Popup({
      className: "bto-map-popup",
      closeButton: true,
      closeOnClick: false,
      maxWidth: "280px",
      offset: 12,
    })
      .setLngLat([school.lng, school.lat])
      .setDOMContent(root)
      .addTo(map);
    popupRef.current = popup;
    popupSlugRef.current = popupKey;
    popup.on("close", () => {
      if (popupSlugRef.current !== popupKey) return;
      popupRef.current = null;
      popupSlugRef.current = null;
    });
  }

  function createMarker(p: ProjectMapItem): maplibregl.Marker {
    const isAnnounced = p.lifecycleStatus === "announced";
    const isSbf = p.saleType === "sbf";
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bto-map-marker";
    el.dataset.focused = "false";
    if (isSbf) el.dataset.variant = "area-sbf";
    else if (isAnnounced) el.dataset.variant = "area";
    el.setAttribute(
      "aria-label",
      isSbf
        ? `${p.name} (balance flats, town-centre location); show details`
        : isAnnounced
          ? `${p.name} (announced, approximate location); show details`
          : `${p.name}; show details`,
    );

    if (isAnnounced || isSbf) {
      const halo = document.createElement("span");
      halo.className = "bto-map-marker__halo";
      halo.setAttribute("aria-hidden", "true");
      el.appendChild(halo);
    }

    const dot = document.createElement("span");
    dot.className = "bto-map-marker__dot";
    dot.setAttribute("aria-hidden", "true");
    el.appendChild(dot);

    el.addEventListener("click", (event) => {
      event.stopPropagation();
      closePopup(false);
      onMarkerClickRef.current?.(p.slug);
    });

    return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]);
  }

  function createMrtMarker(station: MrtMapItem): maplibregl.Marker {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bto-amenity-marker bto-mrt-marker";
    el.setAttribute(
      "aria-label",
      `${station.name}${station.code ? ` ${station.code}` : ""} ${station.mode.toUpperCase()} station; show details`,
    );
    const symbol = createAmenityMapSymbol("mrt", "bto-mrt-marker__symbol");
    el.appendChild(symbol);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelectionClearRef.current?.();
      openMrtPopup(station);
    });
    return new maplibregl.Marker({ element: el }).setLngLat([
      station.lng,
      station.lat,
    ]);
  }

  function createHawkerMarker(centre: HawkerMapItem): maplibregl.Marker {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bto-amenity-marker bto-hawker-marker";
    el.dataset.status = centre.status;
    el.setAttribute(
      "aria-label",
      `${centre.name}, ${centre.status === "planned" ? "planned" : "current"} hawker centre; show details`,
    );
    const symbol = createAmenityMapSymbol(
      "hawker",
      "bto-hawker-marker__symbol",
      centre.status === "planned" ? "planned" : undefined,
    );
    el.appendChild(symbol);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelectionClearRef.current?.();
      openHawkerPopup(centre);
    });
    return new maplibregl.Marker({ element: el }).setLngLat([
      centre.lng,
      centre.lat,
    ]);
  }

  function createParkMarker(park: ParkMapItem): maplibregl.Marker {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bto-amenity-marker bto-park-marker";
    el.setAttribute(
      "aria-label",
      `${park.name}, approximate park-area centre; show details`,
    );
    const symbol = createAmenityMapSymbol("park", "bto-park-marker__symbol");
    el.appendChild(symbol);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelectionClearRef.current?.();
      openParkPopup(park);
    });
    return new maplibregl.Marker({ element: el }).setLngLat([
      park.lng,
      park.lat,
    ]);
  }

  function createPrimarySchoolMarker(
    school: PrimarySchoolMapItem,
  ): maplibregl.Marker {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bto-amenity-marker bto-school-marker";
    el.setAttribute(
      "aria-label",
      `${school.name}, approximate school site; show details`,
    );
    const symbol = createAmenityMapSymbol(
      "school",
      "bto-school-marker__symbol",
    );
    el.appendChild(symbol);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelectionClearRef.current?.();
      openPrimarySchoolPopup(school);
    });
    return new maplibregl.Marker({ element: el }).setLngLat([
      school.lng,
      school.lat,
    ]);
  }

  function applyMrtDensity() {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom();
    const density =
      zoom < MRT_MIN_ZOOM ? "hidden" : zoom < 11.4 ? "quiet" : "full";
    for (const marker of mrtMarkersRef.current.values()) {
      marker.getElement().dataset.density = density;
    }
  }

  function applyHawkerDensity() {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom();
    const density =
      zoom < HAWKER_MIN_ZOOM ? "hidden" : zoom < 12 ? "quiet" : "full";
    for (const marker of hawkerMarkersRef.current.values()) {
      marker.getElement().dataset.density = density;
    }
  }

  function syncMrtMarkers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const markers = mrtMarkersRef.current;
    const items = showMrtStationsRef.current ? mrtStationsRef.current : [];
    const seen = new Set<string>();

    for (const station of items) {
      seen.add(station.id);
      const existing = markers.get(station.id);
      if (existing) {
        existing.setLngLat([station.lng, station.lat]);
      } else {
        markers.set(station.id, createMrtMarker(station).addTo(map));
      }
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    const openMrtId = popupSlugRef.current?.startsWith("mrt:")
      ? popupSlugRef.current.slice(4)
      : null;
    if (openMrtId && !seen.has(openMrtId)) closePopup(false);
    applyMrtDensity();
  }

  function syncHawkerMarkers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const markers = hawkerMarkersRef.current;
    const items = showHawkerCentresRef.current ? hawkerCentresRef.current : [];
    const seen = new Set<string>();

    for (const centre of items) {
      seen.add(centre.id);
      const existing = markers.get(centre.id);
      if (existing) {
        existing.setLngLat([centre.lng, centre.lat]);
      } else {
        markers.set(centre.id, createHawkerMarker(centre).addTo(map));
      }
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    const openHawkerId = popupSlugRef.current?.startsWith("hawker:")
      ? popupSlugRef.current.slice(7)
      : null;
    if (openHawkerId && !seen.has(openHawkerId)) closePopup(false);
    applyHawkerDensity();
  }

  function syncParkMarkers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const markers = parkMarkersRef.current;
    const bounds = map.getBounds();
    const items =
      showParksRef.current && map.getZoom() >= PARK_MIN_ZOOM
        ? parksRef.current.filter((park) =>
            bounds.contains([park.lng, park.lat]),
          )
        : [];
    const seen = new Set<string>();

    for (const park of items) {
      seen.add(park.id);
      const existing = markers.get(park.id);
      if (existing) {
        existing.setLngLat([park.lng, park.lat]);
      } else {
        markers.set(park.id, createParkMarker(park).addTo(map));
      }
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    const openParkId = popupSlugRef.current?.startsWith("park:")
      ? popupSlugRef.current.slice(5)
      : null;
    if (openParkId && !seen.has(openParkId)) closePopup(false);
  }

  function syncPrimarySchoolMarkers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const markers = schoolMarkersRef.current;
    const bounds = map.getBounds();
    const items =
      showPrimarySchoolsRef.current && map.getZoom() >= PRIMARY_SCHOOL_MIN_ZOOM
        ? primarySchoolsRef.current.filter((school) =>
            bounds.contains([school.lng, school.lat]),
          )
        : [];
    const seen = new Set<string>();

    for (const school of items) {
      seen.add(school.id);
      const existing = markers.get(school.id);
      if (existing) {
        existing.setLngLat([school.lng, school.lat]);
      } else {
        markers.set(school.id, createPrimarySchoolMarker(school).addTo(map));
      }
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    const openSchoolId = popupSlugRef.current?.startsWith("school:")
      ? popupSlugRef.current.slice(7)
      : null;
    if (openSchoolId && !seen.has(openSchoolId)) closePopup(false);
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

    const openProjectSlug = popupSlugRef.current?.startsWith("project:")
      ? popupSlugRef.current.slice(8)
      : null;
    if (openProjectSlug && !seen.has(openProjectSlug)) {
      closePopup(true);
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
    syncMrtMarkers();
    syncHawkerMarkers();
    syncParkMarkers();
    syncPrimarySchoolMarkers();
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      center: SG_CENTER,
      zoom: initialZoomRef.current,
      minZoom: SG_MIN_ZOOM,
      maxBounds: SG_BOUNDS,
      attributionControl: { compact: true },
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    mapRef.current = map;
    const markers = markersRef.current;
    const mrtMarkers = mrtMarkersRef.current;
    const hawkerMarkers = hawkerMarkersRef.current;
    const parkMarkers = parkMarkersRef.current;
    const schoolMarkers = schoolMarkersRef.current;

    const onLoad = () => {
      readyRef.current = true;
      setMapZoom(map.getZoom());
      syncMarkers();
    };
    const onMapClick = () => closePopup(true);
    const onZoom = () => {
      applyMrtDensity();
      applyHawkerDensity();
    };
    const onMoveEnd = () => {
      setMapZoom(map.getZoom());
      syncParkMarkers();
      syncPrimarySchoolMarkers();
    };
    map.on("load", onLoad);
    map.on("click", onMapClick);
    map.on("zoom", onZoom);
    map.on("moveend", onMoveEnd);

    return () => {
      map.off("load", onLoad);
      map.off("click", onMapClick);
      map.off("zoom", onZoom);
      map.off("moveend", onMoveEnd);
      readyRef.current = false;
      fittedIdentityRef.current = null;
      closePopup(false);
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      for (const marker of mrtMarkers.values()) marker.remove();
      mrtMarkers.clear();
      for (const marker of hawkerMarkers.values()) marker.remove();
      hawkerMarkers.clear();
      for (const marker of parkMarkers.values()) marker.remove();
      parkMarkers.clear();
      for (const marker of schoolMarkers.values()) marker.remove();
      schoolMarkers.clear();
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
    syncMrtMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncMrtMarkers reads latest refs
  }, [mrtStations, showMrtStations]);

  useEffect(() => {
    syncHawkerMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncHawkerMarkers reads latest refs
  }, [hawkerCentres, showHawkerCentres]);

  useEffect(() => {
    syncParkMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncParkMarkers reads latest refs
  }, [parks, showParks]);

  useEffect(() => {
    syncPrimarySchoolMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncPrimarySchoolMarkers reads latest refs
  }, [primarySchools, showPrimarySchools]);

  useEffect(() => {
    applyFocus();
  }, [focusedSlug]);

  const denseLayersBelowZoom = [
    showMrtStations && mrtStations.length > 0 && mapZoom < MRT_MIN_ZOOM
      ? "MRT and LRT stations"
      : null,
    showHawkerCentres && hawkerCentres.length > 0 && mapZoom < HAWKER_MIN_ZOOM
      ? "hawker centres"
      : null,
    showPrimarySchools &&
    primarySchools.length > 0 &&
    mapZoom < PRIMARY_SCHOOL_MIN_ZOOM
      ? "primary schools"
      : null,
    showParks && parks.length > 0 && mapZoom < PARK_MIN_ZOOM ? "parks" : null,
  ].filter((label): label is string => label !== null);

  const zoomHint =
    denseLayersBelowZoom.length > 0
      ? `Zoom in to see ${denseLayersBelowZoom.join(", ")}`
      : null;

  return (
    <div
      className={cn("relative h-full w-full bg-muted", className)}
      data-map-zoom={mapZoom.toFixed(2)}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Map of BTO and SBF projects in Singapore"
      />
      {zoomHint ? (
        <p
          className="pointer-events-none absolute top-16 right-3 z-10 max-w-[min(18rem,calc(100%-1.5rem))] rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-sm backdrop-blur-sm"
          role="status"
        >
          {zoomHint}
        </p>
      ) : null}
      <div
        className="pointer-events-none absolute top-3 left-3 z-10 hidden max-w-[calc(100%-9rem)] flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface/95 px-3 py-2 text-[11px] font-medium text-ink shadow-sm backdrop-blur-sm lg:flex"
        role="group"
        aria-label="Map legend"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="bto-map-legend__symbol" aria-hidden />
          Launched
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="bto-map-legend__symbol"
            data-variant="announced"
            aria-hidden
          />
          Announced area
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="bto-map-legend__symbol"
            data-variant="sbf"
            aria-hidden
          />
          SBF town
        </span>
        {showMrtStations && mrtStations.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <AmenityMapSymbol kind="mrt" className="bto-mrt-legend__symbol" />
            MRT/LRT
          </span>
        ) : null}
        {showHawkerCentres && hawkerCentres.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <AmenityMapSymbol
              kind="hawker"
              className="bto-hawker-legend__symbol"
            />
            Hawker centre
          </span>
        ) : null}
        {showHawkerCentres &&
        hawkerCentres.some((centre) => centre.status === "planned") ? (
          <span className="inline-flex items-center gap-1.5">
            <AmenityMapSymbol
              kind="hawker"
              className="bto-hawker-legend__symbol"
              variant="planned"
            />
            Planned hawker
          </span>
        ) : null}
        {showParks && parks.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <AmenityMapSymbol kind="park" className="bto-park-legend__symbol" />
            Park area
          </span>
        ) : null}
        {showPrimarySchools && primarySchools.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <AmenityMapSymbol
              kind="school"
              className="bto-school-legend__symbol"
            />
            Primary school
          </span>
        ) : null}
      </div>
    </div>
  );
}
