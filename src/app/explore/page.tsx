import type { Metadata } from "next";

import { paramsIdentity } from "@/components/explore/filter-model";
import { createPageMetadata } from "@/lib/seo";
import { Explorer } from "./explorer";

export const metadata: Metadata = createPageMetadata({
  title: "Explore Singapore BTO and SBF projects",
  description:
    "Explore Singapore BTO projects and SBF town pools on one map. Filter by sale type, status, town, region, price, flat type, wait time and classification.",
  path: "/explore",
});

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Keying remounts the explorer when arriving via a different filtered link
  // (e.g. /explore?town=Tampines), so URL params always seed fresh state.
  return <Explorer key={paramsIdentity(params)} initialParams={params} />;
}
