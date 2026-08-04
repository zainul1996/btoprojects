export type TrainStation = {
  id: string;
  name: string;
  officialName: string;
  mode: "mrt" | "lrt";
  code?: string;
  line?: string;
  lat: number;
  lng: number;
  geometryAccuracy: "approximate";
  geometryRole: "centroid";
  exitCount: number;
  sourceUpdatedAt?: string;
};

export type TrainStationDataset = {
  schemaVersion: 1;
  category: "train_station";
  dataset: {
    id: string;
    publisher: "Land Transport Authority";
    sourceUrl: string;
    retrievedAt: string;
  };
  coverage: {
    stationExits: number;
    stations: number;
    mrt: number;
    lrt: number;
    skippedCodeOnly: number;
    curatedCodeMatches: number;
  };
  items: TrainStation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseTrainStationDataset(value: unknown): TrainStationDataset {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.category !== "train_station" ||
    !isRecord(value.dataset) ||
    value.dataset.publisher !== "Land Transport Authority" ||
    typeof value.dataset.id !== "string" ||
    typeof value.dataset.sourceUrl !== "string" ||
    typeof value.dataset.retrievedAt !== "string" ||
    !isRecord(value.coverage) ||
    !Array.isArray(value.items)
  ) {
    throw new Error("The train-station dataset has an unsupported format.");
  }

  const coverageKeys = [
    "stationExits",
    "stations",
    "mrt",
    "lrt",
    "skippedCodeOnly",
    "curatedCodeMatches",
  ] as const;
  const coverage = value.coverage;
  if (coverageKeys.some((key) => typeof coverage[key] !== "number")) {
    throw new Error("The train-station coverage summary is incomplete.");
  }

  const items = value.items.filter((item): item is TrainStation => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.officialName === "string" &&
      (item.mode === "mrt" || item.mode === "lrt") &&
      typeof item.lat === "number" &&
      Number.isFinite(item.lat) &&
      typeof item.lng === "number" &&
      Number.isFinite(item.lng) &&
      item.geometryAccuracy === "approximate" &&
      item.geometryRole === "centroid" &&
      typeof item.exitCount === "number"
    );
  });

  return {
    schemaVersion: 1,
    category: "train_station",
    dataset: {
      id: value.dataset.id,
      publisher: "Land Transport Authority",
      sourceUrl: value.dataset.sourceUrl,
      retrievedAt: value.dataset.retrievedAt,
    },
    coverage: {
      stationExits: coverage.stationExits as number,
      stations: coverage.stations as number,
      mrt: coverage.mrt as number,
      lrt: coverage.lrt as number,
      skippedCodeOnly: coverage.skippedCodeOnly as number,
      curatedCodeMatches: coverage.curatedCodeMatches as number,
    },
    items,
  };
}
