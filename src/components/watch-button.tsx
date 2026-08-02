"use client";

import { useEffect } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WatchTarget = {
  targetType: "project" | "town" | "mrt";
  /** Project slug, town name, or MRT station code. */
  targetId: string;
  /** Human label shown in the watchlist, e.g. "Bayshore Vista". */
  label: string;
};

type WatchButtonProps = WatchTarget & {
  size?: "sm" | "default";
  className?: string;
};

/**
 * Follow a project/town/station — the only card action gated behind sign-in
 * (guardrail: browsing stays anonymous; saves are account features).
 */
export function WatchButton(props: WatchButtonProps) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <Button type="button" size={props.size ?? "sm"} variant="ghost" className={props.className} disabled>
        <Bell className="size-3.5" aria-hidden />
        Watch
      </Button>
    );
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <Button
          type="button"
          size={props.size ?? "sm"}
          variant="ghost"
          className={props.className}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Bell className="size-3.5" aria-hidden />
          Watch
        </Button>
      </SignInButton>
    );
  }

  return <WatchButtonAuthed {...props} />;
}

function WatchButtonAuthed({ targetType, targetId, label, size = "sm", className }: WatchButtonProps) {
  const upsertUser = useMutation(api.users.upsertCurrent);
  const addWatch = useMutation(api.watchlists.add);
  const removeWatch = useMutation(api.watchlists.remove);
  const mine = useQuery(api.watchlists.listMine, {});
  const entry = mine?.find(
    (e) => e.targetType === targetType && e.targetId === targetId,
  );

  // The users row must exist before watchlist writes; ensure it once per session.
  useEffect(() => {
    void upsertUser({});
  }, [upsertUser]);

  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      if (entry) {
        await removeWatch({ watchlistId: entry._id });
        toast(`Stopped watching ${label}`);
      } else {
        await addWatch({ targetType, targetId, label });
        toast(`Watching ${label}`, {
          description: "You'll be alerted here and on Telegram when official details change.",
        });
      }
    } catch {
      toast.error("Couldn't update your watchlist — please try again");
    }
  };

  const isWatching = entry !== undefined;

  return (
    <Button
      type="button"
      size={size}
      variant="ghost"
      className={cn(className)}
      aria-pressed={isWatching}
      onClick={toggle}
    >
      {isWatching ? (
        <>
          <BellRing className="size-3.5 text-teal-deep" aria-hidden />
          Watching
        </>
      ) : (
        <>
          <Bell className="size-3.5" aria-hidden />
          Watch
        </>
      )}
    </Button>
  );
}
