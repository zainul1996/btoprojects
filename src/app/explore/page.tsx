import type { Metadata } from "next";

import { paramsIdentity } from "@/components/explore/filter-model";
import { Explorer } from "./explorer";

export const metadata: Metadata = {
  title: "Explore BTO and SBF projects — BTOProjects.sg",
  description:
    "Every BTO project and SBF town pool in Singapore on one calm map. Filter by sale type, application status, town, region, price, flat type, wait time and classification.",
};

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
