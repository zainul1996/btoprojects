import { Card, CardContent } from "@/components/ui/card";
import { Price } from "@/components/price";
import { SourceBadge } from "@/components/source-badge";
import { Stat } from "@/components/stat";

import { formatCount, formatMonthYear, type Comparables } from "./utils";

/**
 * Actual resale transactions around this project's town and flat mix —
 * context for what homes here cost today, explicitly not a prediction of
 * this project's future price.
 */
export function ComparableResale({
  townName,
  comparables,
}: {
  townName: string;
  comparables: Comparables;
}) {
  const latest = comparables.transactions.slice(0, 8);

  return (
    <Card>
      <CardContent className="space-y-5 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">
            Resale context — {townName}
          </h3>
          <SourceBadge variant="estimated" size="sm" />
        </div>

        {comparables.count === 0 ? (
          <p className="text-sm text-muted-foreground">
            No resale transactions on record for this flat mix in {townName}{" "}
            yet — the town may be too new for a resale market.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Stat
                label={`Median resale · ${townName}`}
                value={
                  comparables.median !== null ? (
                    <Price value={comparables.median} approx />
                  ) : (
                    "—"
                  )
                }
                note="All matching transactions"
              />
              <Stat
                label="Recent 6-mo median"
                value={
                  comparables.recentMedian !== null ? (
                    <Price value={comparables.recentMedian} approx />
                  ) : (
                    "—"
                  )
                }
                note={`${formatCount(comparables.recentCount)} recent transactions`}
              />
              <Stat
                label="Transactions"
                value={formatCount(comparables.count)}
                note="Matching town & flat mix"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Month
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Block · Street
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Type
                    </th>
                    <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                      Sqm
                    </th>
                    <th scope="col" className="py-2.5 text-right font-medium">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {latest.map((txn) => (
                    <tr key={txn._id}>
                      <td className="tnum py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {formatMonthYear(txn.month)}
                      </td>
                      <td className="py-3 pr-4 font-medium text-ink">
                        {txn.block} {txn.streetName}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">{txn.flatType}</td>
                      <td className="tnum py-3 pr-4 text-right">
                        {Math.round(txn.floorAreaSqm)}
                      </td>
                      <td className="py-3 text-right">
                        <Price value={txn.resalePrice} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Actual HDB resale transactions in {townName} from{" "}
          <a
            href="https://data.gov.sg"
            target="_blank"
            rel="noopener"
            className="text-teal-deep hover:underline"
          >
            data.gov.sg
          </a>
          . Comparables inform context — they are not a prediction of this
          project&apos;s future price.
        </p>
      </CardContent>
    </Card>
  );
}
