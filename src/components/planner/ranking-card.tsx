import Link from "next/link";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import { SourceBadge } from "@/components/source-badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type PlannerResult = Extract<
  FunctionReturnType<typeof api.plannerActions.sendMessage>,
  { ok: true }
>;
export type PlannerRanking = PlannerResult["rankings"][number];
export type PlannerConstraints = PlannerResult["constraints"];

const COMPONENTS: { key: keyof PlannerRanking["breakdown"]; label: string }[] =
  [
    { key: "budgetFit", label: "Budget fit" },
    { key: "waitFit", label: "Wait fit" },
    { key: "flatTypeFit", label: "Flat type fit" },
    { key: "locationFit", label: "Location fit" },
  ];

/**
 * One ranked project under an assistant reply. Score is analysis (computed
 * deterministically server-side); the breakdown stays collapsed until asked.
 */
export function RankingCard({ ranking }: { ranking: PlannerRanking }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/projects/${ranking.slug}`}
            className="font-semibold text-ink hover:text-teal-deep"
          >
            {ranking.name}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ranking.town} · {ranking.classification}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <SourceBadge variant="analysis" size="sm" />
          <span className="tnum text-xl font-semibold text-teal-deeper">
            {ranking.totalScore}
            <span className="text-xs font-normal text-muted-foreground">
              /100
            </span>
          </span>
        </div>
      </div>

      <Accordion>
        <AccordionItem value="breakdown" className="border-b-0">
          <AccordionTrigger className="py-1.5 text-xs font-medium text-muted-foreground">
            Why this score
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-3 pt-1 pb-1">
              {COMPONENTS.map(({ key, label }) => {
                const component = ranking.breakdown[key];
                return (
                  <div key={key}>
                    <dt className="flex items-baseline justify-between gap-2 text-xs font-medium text-ink">
                      <span>{label}</span>
                      <span className="tnum text-muted-foreground">
                        {component.score}/100
                      </span>
                    </dt>
                    <dd>
                      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {component.reasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
