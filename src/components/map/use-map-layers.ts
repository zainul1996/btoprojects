"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  MAP_LAYER_PREFERENCES_KEY,
  parseMapLayerPreferences,
  type MapLayerPreferences,
} from "@/components/map/map-layer-model";

const MAP_LAYER_CHANGE_EVENT = "btoprojects:map-layers-change";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(MAP_LAYER_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(MAP_LAYER_CHANGE_EVENT, onStoreChange);
  };
}

function clientSnapshot(): string | null {
  return window.localStorage.getItem(MAP_LAYER_PREFERENCES_KEY);
}

function serverSnapshot(): null {
  return null;
}

export function useMapLayers(): [
  MapLayerPreferences,
  (update: (current: MapLayerPreferences) => MapLayerPreferences) => void,
] {
  const stored = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const preferences = useMemo(() => parseMapLayerPreferences(stored), [stored]);

  const update = (
    getNext: (current: MapLayerPreferences) => MapLayerPreferences,
  ) => {
    const next = getNext(parseMapLayerPreferences(clientSnapshot()));
    window.localStorage.setItem(
      MAP_LAYER_PREFERENCES_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(new Event(MAP_LAYER_CHANGE_EVENT));
  };

  return [preferences, update];
}
