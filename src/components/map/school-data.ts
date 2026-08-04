export type PrimarySchool = {
  id: string;
  name: string;
  officialName: string;
  address: string;
  postalCode: string;
  schoolLevel: "primary" | "mixed_primary_secondary";
  lat: number;
  lng: number;
  geometryAccuracy: "approximate";
  geometryRole: "site";
  matchMethod: "postal_exact" | "address_search";
  matchedPointCount: number;
  matchedAddress?: string;
};

export type PrimarySchoolDataset = {
  schemaVersion: 1;
  category: "primary_school";
  dataset: {
    id: string;
    name: "School Directory and Information";
    publisher: "Ministry of Education";
    sourceUrl: string;
    retrievedAt: string;
  };
  geocoder: {
    name: "OneMap Search";
    publisher: "Singapore Land Authority";
    sourceUrl: string;
    retrievedAt: string;
  };
  coverage: {
    sourceRows: number;
    eligiblePrimaryRows: number;
    schools: number;
    skipped: number;
    invalidIdentity: number;
    invalidAddress: number;
    noGeocode: number;
    ambiguousGeocode: number;
  };
  items: PrimarySchool[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parsePrimarySchoolDataset(value: unknown): PrimarySchoolDataset {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.category !== "primary_school" ||
    !isRecord(value.dataset) ||
    value.dataset.name !== "School Directory and Information" ||
    value.dataset.publisher !== "Ministry of Education" ||
    typeof value.dataset.id !== "string" ||
    typeof value.dataset.sourceUrl !== "string" ||
    typeof value.dataset.retrievedAt !== "string" ||
    !isRecord(value.geocoder) ||
    value.geocoder.name !== "OneMap Search" ||
    value.geocoder.publisher !== "Singapore Land Authority" ||
    typeof value.geocoder.sourceUrl !== "string" ||
    typeof value.geocoder.retrievedAt !== "string" ||
    !isRecord(value.coverage) ||
    !Array.isArray(value.items)
  ) {
    throw new Error("The primary-school dataset has an unsupported format.");
  }

  const coverageKeys = [
    "sourceRows",
    "eligiblePrimaryRows",
    "schools",
    "skipped",
    "invalidIdentity",
    "invalidAddress",
    "noGeocode",
    "ambiguousGeocode",
  ] as const;
  const coverage = value.coverage;
  if (coverageKeys.some((key) => typeof coverage[key] !== "number")) {
    throw new Error("The primary-school coverage summary is incomplete.");
  }

  const items = value.items.filter((item): item is PrimarySchool => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.officialName === "string" &&
      typeof item.address === "string" &&
      typeof item.postalCode === "string" &&
      (item.schoolLevel === "primary" ||
        item.schoolLevel === "mixed_primary_secondary") &&
      typeof item.lat === "number" &&
      Number.isFinite(item.lat) &&
      typeof item.lng === "number" &&
      Number.isFinite(item.lng) &&
      item.geometryAccuracy === "approximate" &&
      item.geometryRole === "site" &&
      (item.matchMethod === "postal_exact" ||
        item.matchMethod === "address_search") &&
      typeof item.matchedPointCount === "number" &&
      Number.isInteger(item.matchedPointCount) &&
      item.matchedPointCount > 0
    );
  });

  return {
    schemaVersion: 1,
    category: "primary_school",
    dataset: {
      id: value.dataset.id,
      name: "School Directory and Information",
      publisher: "Ministry of Education",
      sourceUrl: value.dataset.sourceUrl,
      retrievedAt: value.dataset.retrievedAt,
    },
    geocoder: {
      name: "OneMap Search",
      publisher: "Singapore Land Authority",
      sourceUrl: value.geocoder.sourceUrl,
      retrievedAt: value.geocoder.retrievedAt,
    },
    coverage: Object.fromEntries(
      coverageKeys.map((key) => [key, coverage[key] as number]),
    ) as PrimarySchoolDataset["coverage"],
    items,
  };
}
