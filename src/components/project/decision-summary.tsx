import { Check } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { SourceBadge } from "@/components/source-badge";
import { formatSgd } from "@/components/price";

import { fromPrice, type ProjectDetails } from "./utils";

/**
 * "Who this suits" — honest derivations from the data, never hype.
 * Every bullet traces to a stored fact; nothing about ballot odds (guardrail:
 * no odds claims). Labelled analysis, because it is interpretation.
 */
function suitBullets(details: ProjectDetails): string[] {
  const { project, town, flatTypes } = details;
  const entry = fromPrice(flatTypes);
  const townName = town?.name ?? project.region;
  const bullets: string[] = [];

  if (project.estimatedWaitMonths <= 30) {
    bullets.push(
      `Buyers who need keys sooner: the estimated wait is ~${project.estimatedWaitMonths} months, shorter than most recent launches.`,
    );
  }
  if (project.classification === "Prime") {
    bullets.push(
      "Owner-occupiers comfortable with a 10-year MOP and a subsidy clawback on resale.",
    );
  } else if (project.classification === "Plus") {
    bullets.push(
      "Households who want a central-ish location and accept moderate resale restrictions.",
    );
  } else if (entry !== null && entry <= 400_000) {
    bullets.push(
      `Budget-first households: Standard-class flats from ${formatSgd(entry)} before grants.`,
    );
  } else {
    bullets.push(
      "Buyers who want standard BTO terms: a 5-year MOP and no resale clawback.",
    );
  }
  if (project.mrtWalkingMinutes > 0 && project.mrtWalkingMinutes <= 7 && project.nearestMrt.length > 0) {
    bullets.push(
      `Commuters: about a ${project.mrtWalkingMinutes}-minute walk to ${project.nearestMrt[0]}.`,
    );
  }
  if (flatTypes.some((f) => f.type === "3Gen")) {
    bullets.push("Multi-generation families: 3Gen flats are on offer.");
  }
  if (flatTypes.some((f) => f.type === "2-room Flexi")) {
    bullets.push("Singles and smaller households: 2-room Flexi flats are on offer.");
  }
  if (project.totalUnits >= 900) {
    bullets.push(
      `Applicants who prefer a larger site: ${project.totalUnits.toLocaleString("en-SG")} units in one launch.`,
    );
  }
  if (bullets.length < 3) {
    bullets.push(`Households set on ${townName} for family, work or familiarity.`);
  }
  return bullets.slice(0, 3);
}

/** The one honest trade-off, picked by severity from the data. */
function keyCompromise(details: ProjectDetails): string {
  const { project, town, flatTypes } = details;
  const entry = fromPrice(flatTypes);
  const townName = town?.name ?? project.region;

  if (project.estimatedWaitMonths >= 48) {
    return `A long wait: estimated ~${project.estimatedWaitMonths} months to key collection.`;
  }
  if (entry !== null && entry >= 550_000) {
    return `Entry prices are high for a BTO: from ${formatSgd(entry)} before grants.`;
  }
  if (project.mrtWalkingMinutes >= 10) {
    return `The nearest MRT is about a ${project.mrtWalkingMinutes}-minute walk away.`;
  }
  if (project.classification !== "Standard") {
    return `${project.classification}-class rules apply at resale: a longer MOP and tighter conditions than Standard flats.`;
  }
  if (project.region !== "Central") {
    return `${townName} sits outside the central region. Weigh commute times.`;
  }
  return "Nothing unusual for its class. Weigh price, wait and location against your plans.";
}

export function DecisionSummary({ details }: { details: ProjectDetails }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">Who this suits</h3>
          <SourceBadge variant="analysis" size="sm" />
        </div>
        <ul className="space-y-2.5">
          {suitBullets(details).map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-teal-deep" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-border/60 pt-3 text-sm">
          <span className="font-medium text-ink">Key compromise: </span>
          <span className="text-muted-foreground">{keyCompromise(details)}</span>
        </p>
      </CardContent>
    </Card>
  );
}
