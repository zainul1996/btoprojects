import { haversineKm } from "../../convex/lib/geo";
import {
  isSingaporeCoordinate,
  type SavedGeoPoint,
} from "../../convex/lib/profilePreferences";

export interface PresentedDistance {
  key: string;
  label: string;
  kind: "Workplace" | "Parents’ area";
  distanceKm: number;
  text: string;
}

export function projectPreferenceDistances(input: {
  saleType?: "bto" | "sbf";
  projectLat: number;
  projectLng: number;
  workplaces: SavedGeoPoint[];
  parentsArea?: SavedGeoPoint;
}): PresentedDistance[] {
  if (
    input.saleType === "sbf" ||
    !isSingaporeCoordinate(input.projectLat, input.projectLng)
  ) {
    return [];
  }

  const points = [
    ...input.workplaces.map((point, index) => ({
      point,
      kind: "Workplace" as const,
      key: `workplace-${index}`,
    })),
    ...(input.parentsArea
      ? [
          {
            point: input.parentsArea,
            kind: "Parents’ area" as const,
            key: "parents",
          },
        ]
      : []),
  ];

  return points
    .filter(({ point }) => isSingaporeCoordinate(point.lat, point.lng))
    .map(({ point, kind, key }) => {
    const distanceKm =
      Math.round(
        haversineKm(
          input.projectLat,
          input.projectLng,
          point.lat,
          point.lng,
        ) * 10,
      ) / 10;
    return {
      key,
      label: point.address ?? point.label,
      kind,
      distanceKm,
      text:
        distanceKm < 1
          ? "Under 1 km"
          : `About ${Math.round(distanceKm)} km`,
    };
    });
}
