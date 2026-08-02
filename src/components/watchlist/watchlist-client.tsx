"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { Bell } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertsTab } from "@/components/watchlist/alerts-tab";
import { useAuthedUser } from "@/components/watchlist/use-authed-user";
import { WatchingTab } from "@/components/watchlist/watching-tab";

export type WatchlistTab = "watching" | "alerts";

export function WatchlistClient({
  initialTab,
  signedIn,
}: {
  initialTab: WatchlistTab;
  /** Server-resolved auth state — determines SSR markup. */
  signedIn: boolean;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  // Before Clerk hydrates, trust the server-resolved value (no flash);
  // after, client truth wins (modal sign-in flips without navigation).
  const authed = isLoaded ? isSignedIn === true : signedIn;

  if (!authed) {
    return (
      <EmptyState
        icon={Bell}
        title="Sign in to watch places"
        hint="Watching is how you get alerts when HDB updates a project, town or station you care about."
        action={
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
        }
      />
    );
  }

  return <AuthedWatchlist initialTab={initialTab} />;
}

function AuthedWatchlist({ initialTab }: { initialTab: WatchlistTab }) {
  const ready = useAuthedUser();

  return (
    <Tabs defaultValue={initialTab}>
      <TabsList>
        <TabsTrigger value="watching">Watching</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
      </TabsList>
      <TabsContent value="watching" className="pt-5">
        <WatchingTab ready={ready} />
      </TabsContent>
      <TabsContent value="alerts" className="pt-5">
        <AlertsTab ready={ready} />
      </TabsContent>
    </Tabs>
  );
}
