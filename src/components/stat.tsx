import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type StatProps = ComponentProps<"div"> & {
  /** Small muted label rendered above the value. */
  label: string
  /** Numeric display value — rendered large, semibold, tabular. */
  value: ReactNode
  /** Optional one-line context under the value. */
  note?: string
}

function Stat({ label, value, note, className, ...props }: StatProps) {
  return (
    <div
      data-slot="stat"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="tnum text-2xl font-semibold text-ink md:text-3xl">
        {value}
      </span>
      {note ? (
        <span className="text-xs text-muted-foreground">{note}</span>
      ) : null}
    </div>
  )
}

export { Stat }
