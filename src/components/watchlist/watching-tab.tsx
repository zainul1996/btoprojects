"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Bell, Building2, MapPin, TrainFront } from "lucide-react";
import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { townHref } from "@/components/project/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/components/watchlist/format";

type WatchEntry = FunctionReturnType<typeof api.watchlists.listMine>[number];

type Group = {
  targetType: WatchEntry["targetType"];
  title: string;
  typeLabel: string;
  icon: typeof Building2;
};

const GROUPS: Group[] = [
  { targetType: "project", title: "Projects", typeLabel: "Project", icon: Building2 },
  { targetType: "town", title: "Towns", typeLabel: "Town", icon: MapPin },
  { targetType: "mrt", title: "MRT stations", typeLabel: "MRT", icon: TrainFront },
];

function viewHref(entry: WatchEntry): string {
  switch (entry.targetType) {
    case "project":
      return `/projects/${entry.targetId}`;
    case "town":
      return townHref(entry.targetId);
    case "mrt":
      return `/explore?q=${encodeURIComponent(entry.label)}`;
  }
}

export function WatchingTab({ ready }: { ready: boolean }) {
  const entries = useQuery(api.watchlists.listMine, ready ? {} : "skip");
  const removeWatch = useMutation(api.watchlists.remove);

  if (entries === undefined) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading watchlist">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="You're not watching anything yet"
        hint="Watch a project or town and we'll alert you when official details change."
        action={
          <Button render={<Link href="/explore" />} nativeButton={false}>
            Browse projects
          </Button>
        }
      />
    );
  }

  const remove = async (entry: WatchEntry) => {
    try {
      await removeWatch({ watchlistId: entry._id });
      toast(`Stopped watching ${entry.label}`);
    } catch {
      toast.error("Couldn't update your watchlist. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => {
        const rows = entries.filter((e) => e.targetType === group.targetType);
        if (rows.length === 0) return null;
        return (
          <section key={group.targetType} aria-label={group.title}>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <group.icon className="size-4 text-muted-foreground" aria-hidden />
              {group.title}
              <span className="tnum font-normal text-muted-foreground">
                {rows.length}
              </span>
            </h3>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {rows.map((entry) => (
                <li
                  key={entry._id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {entry.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Since {formatDate(entry.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {group.typeLabel}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={viewHref(entry)} />}
                      nativeButton={false}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void remove(entry)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
