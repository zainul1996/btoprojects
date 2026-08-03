import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";

import { PageHeader } from "@/components/page-header";
import { WatchlistClient } from "@/components/watchlist/watchlist-client";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Saved & alerts",
  description:
    "Saved projects, towns and MRT stations, with in-app alerts for official BTO and SBF project or town updates.",
  path: "/watchlist",
  index: false,
});

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab =
    tab === "alerts"
      ? "alerts"
      : tab === "preferences"
        ? "preferences"
        : "watching";
  // Server-resolved auth so anonymous visitors see the gate on first paint
  // (client Clerk state reconciles after hydration — modal sign-in included).
  const { userId } = await auth();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 md:px-6">
      <PageHeader
        title="Saved & alerts"
        lede="Follow a project or town to receive in-app alerts when HDB publishes applicant, supply or deadline updates."
      />
      <WatchlistClient initialTab={initialTab} signedIn={userId !== null} />
    </div>
  );
}
