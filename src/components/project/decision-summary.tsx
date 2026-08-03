import { formatSgd } from "@/components/price";
import { SourceBadge } from "@/components/source-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { fromPrice, type ProjectDetails } from "./utils";

type DecisionFact = {
  label: string;
  value: string;
};

function flatMix(details: ProjectDetails): string {
  const types = details.flatTypes.map((flat) => flat.type);
  return types.length > 0 ? types.join(", ") : "Flat types to be confirmed";
}

function priceAndTiming(details: ProjectDetails): string {
  const { project, flatTypes } = details;
  if (project.saleType === "sbf") {
    return "Price and key timing vary by individual flat";
  }

  const price = fromPrice(flatTypes);
  const parts: string[] = [];
  if (price !== null) parts.push(`From ${formatSgd(price)} before grants`);
  if (project.estimatedWaitMonths > 0) {
    parts.push(`about ${project.estimatedWaitMonths} months to keys`);
  }
  return parts.length > 0 ? parts.join("; ") : "Price and timeline to be confirmed";
}

function accessSummary(details: ProjectDetails): string {
  const { project, town } = details;
  const station = project.nearestMrt[0];
  if (station && project.mrtWalkingMinutes > 0) {
    return `About ${project.mrtWalkingMinutes} minutes on foot to ${station}`;
  }
  if (station) return `Near ${station}; walking time is not confirmed`;
  return `${town?.name ?? project.region}, ${project.region} region`;
}

function rulesSummary(details: ProjectDetails): string {
  const { project } = details;
  if (project.saleType === "sbf") {
    return "Lease, classification and resale rules vary by individual flat";
  }
  if (
    project.classification === "Prime" ||
    project.classification === "Plus"
  ) {
    return "10-year MOP, subsidy recovery and tighter resale conditions";
  }
  if (project.classification === "Standard") {
    return "5-year MOP; prevailing resale rules apply";
  }
  return "Classification rules to be confirmed";
}

function decisionFacts(details: ProjectDetails): DecisionFact[] {
  return [
    { label: "Price and timing", value: priceAndTiming(details) },
    { label: "Access", value: accessSummary(details) },
    { label: "Homes available", value: flatMix(details) },
    { label: "Rules to weigh", value: rulesSummary(details) },
  ];
}

function keyTradeOff(details: ProjectDetails): string {
  const { project, town, flatTypes } = details;
  const entry = fromPrice(flatTypes);
  const townName = town?.name ?? project.region;

  if (project.saleType === "sbf") {
    return `You apply for the ${townName} town pool, not a specific block. Price, lease and key timing depend on the flat offered.`;
  }
  if (project.estimatedWaitMonths >= 48) {
    return `The estimated wait is about ${project.estimatedWaitMonths} months to key collection.`;
  }
  if (entry !== null && entry >= 550_000) {
    return `The published starting price is ${formatSgd(entry)} before grants.`;
  }
  if (project.mrtWalkingMinutes >= 10) {
    return `The nearest MRT is about ${project.mrtWalkingMinutes} minutes away on foot.`;
  }
  if (
    project.classification === "Plus" ||
    project.classification === "Prime"
  ) {
    return `${project.classification} resale rules are tighter than Standard flat rules.`;
  }
  return "No single issue dominates. Compare price, wait and location with another option.";
}

export function DecisionSummary({ details }: { details: ProjectDetails }) {
  const facts = decisionFacts(details);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          <h3>What stands out</h3>
        </CardTitle>
        <CardDescription>
          Facts from the current project record, followed by one labelled
          trade-off.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="border-l-2 border-border pl-3">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {fact.label}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Key trade-off
          </p>
          <SourceBadge variant="analysis" size="sm" />
        </div>
        <p className="text-sm text-ink">{keyTradeOff(details)}</p>
      </CardFooter>
    </Card>
  );
}
