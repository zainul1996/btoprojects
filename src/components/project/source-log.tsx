import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LastVerified } from "@/components/last-verified";

import { formatTimestamp, latestRetrievedAt, type ProjectDetails } from "./utils";

const KIND_LABEL: Record<string, string> = {
  hdb: "HDB",
  publisher: "Publisher",
  datagov: "data.gov.sg",
  onemap: "OneMap",
  manual: "Manual",
  research: "Research",
};

/**
 * Provenance is the product: every source behind this page, with publisher,
 * kind and retrieval date. Corrections are invited in plain language.
 */
export function SourceLog({ details }: { details: ProjectDetails }) {
  const { sources } = details;
  const sorted = [...sources].sort((a, b) => b.retrievedAt - a.retrievedAt);

  return (
    <Card className="bg-muted/40">
      <CardContent className="space-y-4 p-5 md:p-6">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No external sources recorded for this project yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {sorted.map((source) => (
              <li key={source._id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-teal-deep hover:underline"
                  >
                    <span className="truncate">{source.publisher}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                  <Badge variant="outline" className="font-normal">
                    {KIND_LABEL[source.kind] ?? source.kind}
                  </Badge>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Retrieved {formatTimestamp(source.retrievedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            See something wrong? Every fact above carries its source.
            Corrections welcome.
          </p>
          <LastVerified date={latestRetrievedAt(details)} />
        </div>
      </CardContent>
    </Card>
  );
}
