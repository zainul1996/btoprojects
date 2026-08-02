"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { BellRing, Inbox, Send } from "lucide-react";
import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/components/watchlist/format";
import { cn } from "@/lib/utils";

type Alert = FunctionReturnType<typeof api.alerts.listMine>["page"][number];

const KIND_LABELS: Record<Alert["kind"], string> = {
  project_update: "Project update",
  new_launch: "New launch",
  exercise_open: "Exercise open",
  system: "System",
  test: "Test",
};

const VIA_META: Record<string, { icon: typeof BellRing; label: string }> = {
  inapp: { icon: BellRing, label: "Delivered in app" },
  telegram: { icon: Send, label: "Delivered on Telegram" },
};

export function AlertsTab({ ready }: { ready: boolean }) {
  const unread = useQuery(api.alerts.unreadCount, ready ? {} : "skip");
  const { results, status, loadMore } = usePaginatedQuery(
    api.alerts.listMine,
    ready ? {} : "skip",
    { initialNumItems: 20 },
  );
  const markRead = useMutation(api.alerts.markRead);
  const markAllRead = useMutation(api.alerts.markAllRead);
  const [markingAll, setMarkingAll] = useState(false);

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await markAllRead({});
    } catch {
      toast.error("Couldn't mark alerts as read — please try again");
    } finally {
      setMarkingAll(false);
    }
  };

  const openAlert = (alert: Alert) => {
    if (alert.read) return;
    markRead({ alertId: alert._id }).catch(() => {
      toast.error("Couldn't mark that alert as read");
    });
  };

  if (results === undefined) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading alerts">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {unread !== undefined && unread > 0 ? (
            <>
              <span className="tnum font-semibold text-ink">{unread}</span>{" "}
              unread
            </>
          ) : (
            "All caught up"
          )}
        </p>
        {unread !== undefined && unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markAll()}
            disabled={markingAll}
          >
            {markingAll ? "Marking…" : "Mark all read"}
          </Button>
        )}
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No alerts yet"
          hint="When something you watch changes, it lands here first."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {results.map((alert) => (
            <li key={alert._id}>
              <button
                type="button"
                onClick={() => openAlert(alert)}
                aria-label={
                  alert.read ? alert.title : `Unread alert: ${alert.title}`
                }
                className={cn(
                  "block w-full border-l-2 px-4 py-3.5 text-left transition-colors",
                  alert.read
                    ? "border-transparent"
                    : "border-teal bg-teal-subtle/30 hover:bg-teal-subtle/50",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    className={cn(
                      "text-sm",
                      alert.read
                        ? "text-muted-foreground"
                        : "font-semibold text-ink",
                    )}
                  >
                    {alert.title}
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    {KIND_LABELS[alert.kind]}
                  </Badge>
                  <span className="tnum ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
                    {alert.deliveredVia.map((via) => {
                      const meta = VIA_META[via];
                      if (!meta) return null;
                      return (
                        <meta.icon
                          key={via}
                          className="size-3.5"
                          aria-label={meta.label}
                        />
                      );
                    })}
                    {formatDateTime(alert.createdAt)}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    alert.read ? "text-muted-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {alert.body}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => loadMore(20)}>
            Load more
          </Button>
        </div>
      )}
      {status === "LoadingMore" && (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      )}

      <TestAlertCard />
    </div>
  );
}

/** W5–6 acceptance surrogate: proves the in-app + Telegram loop on demand. */
function TestAlertCard() {
  const sendTest = useMutation(api.alertsEngine.sendMeTestAlert);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await sendTest({});
      toast("Alert created — check this tab and Telegram");
    } catch {
      toast.error("Couldn't send a test alert — please try again");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-muted/40 ring-0">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div>
          <p className="text-sm font-medium text-ink">See how alerts work</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sends a test alert to this inbox and your Telegram.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void send()}
          disabled={sending}
        >
          {sending ? "Sending…" : "Send me a test alert"}
        </Button>
      </CardContent>
    </Card>
  );
}
