import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/** Deterministic SGD grouping — "S$420,000". No Intl locale drift. */
function formatSgd(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? "-" : ""
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${sign}S$${digits}`
}

type PriceProps = ComponentProps<"span"> & {
  value: number
  /** Renders a "~" prefix for estimated figures. */
  approx?: boolean
}

function Price({ value, approx = false, className, ...props }: PriceProps) {
  return (
    <span
      data-slot="price"
      className={cn("tnum whitespace-nowrap", className)}
      {...props}
    >
      {approx ? "~" : ""}
      {formatSgd(value)}
    </span>
  )
}

export { Price, formatSgd }
