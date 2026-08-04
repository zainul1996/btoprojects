export type HawkerCentre = {
  id: string;
  name: string;
  status: "current" | "planned";
  sourceStatus: string;
  address?: string;
  lat: number;
  lng: number;
  geometryAccuracy: "exact";
  geometryRole: "site";
  sourceUpdatedAt?: string;
  cookedFoodStalls?: number;
};

export type HawkerDataset = {
  schemaVersion: 1;
  category: "hawker";
  dataset: {
    id: string;
    publisher: "National Environment Agency";
    sourceUrl: string;
    retrievedAt: string;
  };
  items: HawkerCentre[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseHawkerDataset(value: unknown): HawkerDataset {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.category !== "hawker" ||
    !isRecord(value.dataset) ||
    value.dataset.publisher !== "National Environment Agency" ||
    typeof value.dataset.id !== "string" ||
    typeof value.dataset.sourceUrl !== "string" ||
    typeof value.dataset.retrievedAt !== "string" ||
    !Array.isArray(value.items)
  ) {
    throw new Error("The hawker-centre dataset has an unsupported format.");
  }

  const items = value.items.filter((item): item is HawkerCentre => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      (item.status === "current" || item.status === "planned") &&
      typeof item.sourceStatus === "string" &&
      typeof item.lat === "number" &&
      Number.isFinite(item.lat) &&
      typeof item.lng === "number" &&
      Number.isFinite(item.lng) &&
      item.geometryAccuracy === "exact" &&
      item.geometryRole === "site"
    );
  });

  return {
    schemaVersion: 1,
    category: "hawker",
    dataset: {
      id: value.dataset.id,
      publisher: "National Environment Agency",
      sourceUrl: value.dataset.sourceUrl,
      retrievedAt: value.dataset.retrievedAt,
    },
    items,
  };
}
