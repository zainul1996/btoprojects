import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export type LifecycleStage =
  | "announced"
  | "launched"
  | "construction"
  | "sbf"
  | "mop"

/**
 * Lifecycle pill. Stages differ by dot treatment (hollow/solid/neutral) as
 * well as colour family, so they read without relying on colour alone:
 * announced/launched teal-family, construction neutral, sbf navy, mop muted.
 */
const STAGES: Record<
  LifecycleStage,
  { label: string; chip: string; dot: string }
> = {
  announced: {
    label: "Announced",
    chip: "border-teal-deep/20 bg-teal-subtle/50 text-teal-deeper",
    dot: "border-[1.5px] border-teal-deep bg-transparent",
  },
  launched: {
    label: "Launched",
    chip: "border-teal-deep/20 bg-teal-subtle text-teal-deeper",
    dot: "bg-teal-deep",
  },
  construction: {
    label: "Under construction",
    chip: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  sbf: {
    label: "SBF",
    chip: "border-navy/20 bg-navy/5 text-navy",
    dot: "bg-navy",
  },
  mop: {
    label: "MOP",
    chip: "border-border bg-transparent text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
}

type LifecycleChipProps = ComponentProps<"span"> & {
  stage: LifecycleStage
}

function LifecycleChip({ stage, className, ...props }: LifecycleChipProps) {
  const { label, chip, dot } = STAGES[stage]
  return (
    <span
      data-slot="lifecycle-chip"
      data-stage={stage}
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap select-none",
        chip,
        className
      )}
      {...props}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  )
}

export { LifecycleChip }
