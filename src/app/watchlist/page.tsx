import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";

import { PageHeader } from "@/components/page-header";
import { WatchlistClient } from "@/components/watchlist/watchlist-client";

export const metadata: Metadata = {
  title: "Watchlist and alerts",
  description:
    "Projects, towns and MRT stations you're watching on BTOProjects.sg, plus every alert they've triggered.",
};

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "alerts" ? "alerts" : "watching";
  // Server-resolved auth so anonymous visitors see the gate on first paint
  // (client Clerk state reconciles after hydration — modal sign-in included).
  const { userId } = await auth();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 md:px-6">
      <PageHeader
        title="Watchlist"
        lede="Places you're watching, and the alerts they've triggered."
      />
      <WatchlistClient initialTab={initialTab} signedIn={userId !== null} />
    </div>
  );
}
