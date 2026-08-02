import { cn } from "@/lib/utils";
import type { LifecycleStage } from "@/components/lifecycle-chip";

const STEPS = [
  { key: "announced", label: "Announced" },
  { key: "launched", label: "Launched" },
  { key: "application", label: "Application" },
  { key: "construction", label: "Construction" },
  { key: "keys", label: "Key collection" },
  { key: "sbf", label: "SBF" },
  { key: "mop", label: "MOP" },
] as const;

/** Where a project status sits on the 7-step journey. */
const STATUS_ORDER: Record<LifecycleStage, number> = {
  announced: 0,
  launched: 1,
  construction: 3,
  sbf: 5,
  mop: 6,
};

/**
 * The full BTO journey with this project's position — current step teal,
 * completed steps filled navy, future steps hollow (readable without
 * relying on colour alone, per the accessibility floor).
 */
export function LifecycleStepper({ status }: { status: LifecycleStage }) {
  const current = STATUS_ORDER[status];

  return (
    <ol className="flex flex-wrap items-center gap-y-4">
      {STEPS.map((step, index) => {
        const state =
          index < current ? "done" : index === current ? "current" : "future";
        return (
          <li key={step.key} className="flex items-center">
            {index > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "mx-2 h-px w-4 sm:w-6 md:w-8",
                  index <= current ? "bg-navy/40" : "bg-border",
                )}
              />
            ) : null}
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  state === "done" && "bg-navy",
                  state === "current" && "bg-teal ring-4 ring-teal-subtle",
                  state === "future" && "border-[1.5px] border-muted-foreground/50 bg-transparent",
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap sm:text-sm",
                  state === "done" && "text-ink",
                  state === "current" && "text-teal-deeper",
                  state === "future" && "text-muted-foreground",
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                {step.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
