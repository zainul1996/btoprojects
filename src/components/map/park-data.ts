export type Park = {
  id: string;
  name: string;
  officialName: string;
  lat: number;
  lng: number;
  geometryAccuracy: "approximate";
  geometryRole: "centroid";
  sourceGeometryType: "Polygon" | "MultiPolygon";
  sourceUpdatedAt?: string;
};

export type ParkDataset = {
  schemaVersion: 1;
  category: "park";
  dataset: {
    id: string;
    name: "NParks Parks and Nature Reserves";
    publisher: "National Parks Board";
    sourceUrl: string;
    retrievedAt: string;
    sourceLastUpdatedAt: string;
  };
  coverage: {
    sourceFeatures: number;
    parks: number;
    skipped: number;
    invalidIdentity: number;
    invalidGeometry: number;
  };
  items: Park[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseParkDataset(value: unknown): ParkDataset {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.category !== "park" ||
    !isRecord(value.dataset) ||
    value.dataset.name !== "NParks Parks and Nature Reserves" ||
    value.dataset.publisher !== "National Parks Board" ||
    typeof value.dataset.id !== "string" ||
    typeof value.dataset.sourceUrl !== "string" ||
    typeof value.dataset.retrievedAt !== "string" ||
    typeof value.dataset.sourceLastUpdatedAt !== "string" ||
    !isRecord(value.coverage) ||
    !Array.isArray(value.items)
  ) {
    throw new Error("The park dataset has an unsupported format.");
  }

  const coverageKeys = [
    "sourceFeatures",
    "parks",
    "skipped",
    "invalidIdentity",
    "invalidGeometry",
  ] as const;
  const coverage = value.coverage;
  if (coverageKeys.some((key) => typeof coverage[key] !== "number")) {
    throw new Error("The park coverage summary is incomplete.");
  }

  const items = value.items.filter((item): item is Park => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.officialName === "string" &&
      typeof item.lat === "number" &&
      Number.isFinite(item.lat) &&
      typeof item.lng === "number" &&
      Number.isFinite(item.lng) &&
      item.geometryAccuracy === "approximate" &&
      item.geometryRole === "centroid" &&
      (item.sourceGeometryType === "Polygon" ||
        item.sourceGeometryType === "MultiPolygon")
    );
  });

  return {
    schemaVersion: 1,
    category: "park",
    dataset: {
      id: value.dataset.id,
      name: "NParks Parks and Nature Reserves",
      publisher: "National Parks Board",
      sourceUrl: value.dataset.sourceUrl,
      retrievedAt: value.dataset.retrievedAt,
      sourceLastUpdatedAt: value.dataset.sourceLastUpdatedAt,
    },
    coverage: Object.fromEntries(
      coverageKeys.map((key) => [key, coverage[key] as number]),
    ) as ParkDataset["coverage"],
    items,
  };
}
