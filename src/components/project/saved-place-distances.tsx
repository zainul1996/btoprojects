"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { BriefcaseBusiness, Users } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { SourceBadge } from "@/components/source-badge";
import { useAuthedUser } from "@/components/watchlist/use-authed-user";
import { projectPreferenceDistances } from "@/lib/profile-distance";

export function SavedPlaceDistances({
  saleType,
  projectLat,
  projectLng,
}: {
  saleType?: "bto" | "sbf";
  projectLat: number;
  projectLng: number;
}) {
  const ready = useAuthedUser();
  const profile = useQuery(api.profile.get, ready ? {} : "skip");
  if (!ready || !profile) return null;

  const distances = projectPreferenceDistances({
    saleType,
    projectLat,
    projectLng,
    workplaces: profile.workplaces,
    parentsArea: profile.parentsArea,
  });
  if (distances.length === 0) return null;

  return (
    <section
      aria-labelledby="saved-place-distances"
      className="border-t border-border/60 pt-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="saved-place-distances" className="text-sm font-semibold text-ink">
          Distance to your saved places
        </h4>
        <SourceBadge variant="analysis" size="sm" />
      </div>
      <ul className="mt-3 space-y-3">
        {distances.map((distance) => {
          const Icon =
            distance.kind === "Workplace" ? BriefcaseBusiness : Users;
          return (
            <li key={distance.key} className="flex items-start gap-2.5 text-sm">
              <Icon
                className="mt-0.5 size-4 shrink-0 text-teal-deep"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block font-medium text-ink">
                  {distance.text} · {distance.kind}
                </span>
                <span className="block text-xs break-words text-muted-foreground">
                  {distance.label}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Straight-line distance from an approximate project location, not route
        distance or travel time.{" "}
        <Link
          href="/watchlist?tab=preferences"
          className="text-teal-deep hover:underline"
        >
          Edit saved places
        </Link>
      </p>
    </section>
  );
}
