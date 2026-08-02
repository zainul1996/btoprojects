"use client";

import { formatSgd } from "@/components/price";
import type { PlannerConstraints } from "@/components/planner/ranking-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The interpreted constraints ("You said: …") above the input — the machine's
 * reading of the user's situation. Read-only for MVP; correction happens by
 * replying in chat.
 */
export function ConstraintsBar({
  constraints,
}: {
  constraints: PlannerConstraints;
}) {
  const chips: string[] = [];
  if (constraints?.budgetMax !== undefined) {
    chips.push(`Budget ≤ ${formatSgd(constraints.budgetMax)}`);
  }
  if (constraints?.flatTypes?.length) {
    chips.push(constraints.flatTypes.join(", "));
  }
  if (constraints?.waitToleranceMonths !== undefined) {
    chips.push(`Wait ≤ ${constraints.waitToleranceMonths} mo`);
  }
  for (const town of constraints?.towns ?? []) chips.push(town);
  for (const region of constraints?.regions ?? []) chips.push(region);
  for (const workplace of constraints?.workplaces ?? []) {
    chips.push(`Work: ${workplace}`);
  }
  if (constraints?.parentsArea) {
    chips.push(`Parents: ${constraints.parentsArea}`);
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2.5">
      <span className="text-xs text-muted-foreground">You said:</span>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="flex flex-wrap items-center gap-1.5 cursor-help" />
          }
        >
          {chips.map((chip) => (
            <span
              key={chip}
              className="tnum inline-flex items-center rounded-full border border-dashed border-input bg-surface px-2.5 py-1 text-xs font-medium text-ink"
            >
              {chip}
            </span>
          ))}
        </TooltipTrigger>
        <TooltipContent>Reply in chat to change these</TooltipContent>
      </Tooltip>
    </div>
  );
}
