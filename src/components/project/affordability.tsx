import { Card, CardContent } from "@/components/ui/card";
import { Price } from "@/components/price";
import { SourceBadge } from "@/components/source-badge";
import { Stat } from "@/components/stat";

import { fromPrice, monthlyPayment, type ProjectDetails } from "./utils";

const LOAN_YEARS = 25;
const HDB_CONCESSIONARY_RATE = 0.026;
const DOWNPAYMENT_SHARE = 0.25;

/**
 * A single worked example from the lowest-priced flat type — indicative
 * numbers only, never valuation framing (strategy: no resale promises).
 */
export function Affordability({ details }: { details: ProjectDetails }) {
  const { flatTypes } = details;
  const entry = fromPrice(flatTypes);
  if (entry === null) return null;

  const cheapest = [...flatTypes].sort((a, b) => a.minPrice - b.minPrice)[0];
  const downpayment = entry * DOWNPAYMENT_SHARE;
  const monthly = monthlyPayment(
    entry * (1 - DOWNPAYMENT_SHARE),
    HDB_CONCESSIONARY_RATE,
    LOAN_YEARS,
  );

  return (
    <Card>
      <CardContent className="space-y-5 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">
            Downpayment &amp; monthly estimate
          </h3>
          <SourceBadge variant="estimated" size="sm" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Stat
            label="Indicative from"
            value={<Price value={entry} />}
            note={cheapest ? `${cheapest.type} from-price` : "Lowest from-price"}
          />
          <Stat
            label="25% downpayment"
            value={<Price value={downpayment} approx />}
            note="CPF/cash mix varies"
          />
          <Stat
            label="Est. monthly"
            value={<Price value={monthly} approx />}
            note={`${LOAN_YEARS}-yr HDB loan · 2.6%`}
          />
        </div>

        <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Indicative only: assumes a {LOAN_YEARS}-year HDB loan at 2.6%. Not
          financial advice. Grants may reduce cost; check{" "}
          <a
            href="https://www.hdb.gov.sg"
            target="_blank"
            rel="noopener"
            className="text-teal-deep hover:underline"
          >
            hdb.gov.sg
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
