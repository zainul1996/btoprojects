"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertsTab } from "@/components/watchlist/alerts-tab";
import { PreferencesTab } from "@/components/watchlist/preferences-tab";
import { useAuthedUser } from "@/components/watchlist/use-authed-user";
import { WatchingTab } from "@/components/watchlist/watching-tab";

export type WatchlistTab = "watching" | "alerts" | "preferences";

export function WatchlistClient({
  initialTab,
  signedIn,
}: {
  initialTab: WatchlistTab;
  /** Server-resolved auth state — determines SSR markup. */
  signedIn: boolean;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  // Before Clerk hydrates, trust the server-resolved value (no flash);
  // after, client truth wins (modal sign-in flips without navigation).
  const authed = isLoaded ? isSignedIn === true : signedIn;

  if (!authed) {
    return (
      <EmptyState
        icon={Bell}
        title="Sign in to save places"
        hint="Follow projects, receive in-app alerts and save private planning preferences."
        action={
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
        }
      />
    );
  }

  const ownerKey = isLoaded ? (userId ?? "signed-out") : "server-signed-in";
  return (
    <AuthedWatchlist
      key={`${ownerKey}:${initialTab}`}
      initialTab={initialTab}
      owner={isLoaded ? (userId ?? undefined) : undefined}
    />
  );
}

function AuthedWatchlist({
  initialTab,
  owner,
}: {
  initialTab: WatchlistTab;
  owner?: string;
}) {
  const ready = useAuthedUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WatchlistTab>(initialTab);
  const [preferencesDirty, setPreferencesDirty] = useState(false);

  const selectTab = (value: string) => {
    const nextTab: WatchlistTab =
      value === "alerts"
        ? "alerts"
        : value === "preferences"
          ? "preferences"
          : "watching";
    if (
      activeTab === "preferences" &&
      nextTab !== "preferences" &&
      preferencesDirty &&
      !window.confirm(
        "Leave Preferences with unsaved changes? Your draft will stay in this tab.",
      )
    ) {
      return;
    }
    setActiveTab(nextTab);
    router.replace(
      nextTab === "watching" ? "/watchlist" : `/watchlist?tab=${nextTab}`,
      { scroll: false },
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={selectTab}>
      <TabsList>
        <TabsTrigger value="watching">Following</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
      </TabsList>
      <TabsContent value="watching" className="pt-5" keepMounted>
        <WatchingTab ready={ready} />
      </TabsContent>
      <TabsContent value="alerts" className="pt-5" keepMounted>
        <AlertsTab ready={ready} />
      </TabsContent>
      <TabsContent value="preferences" className="pt-5" keepMounted>
        <PreferencesTab
          ready={ready}
          owner={owner}
          onDirtyChange={setPreferencesDirty}
        />
      </TabsContent>
    </Tabs>
  );
}
