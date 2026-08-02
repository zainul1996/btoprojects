import { Clock } from "lucide-react"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/** Hand-rolled "d MMM yyyy" — no date library. */
function formatVerifiedDate(input: Date | string | number): {
  text: string
  iso: string | undefined
} {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return { text: "unknown", iso: undefined }
  return {
    text: `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
    iso: date.toISOString().slice(0, 10),
  }
}

type LastVerifiedProps = ComponentProps<"time"> & {
  date: Date | string | number
}

function LastVerified({ date, className, ...props }: LastVerifiedProps) {
  const { text, iso } = formatVerifiedDate(date)
  return (
    <time
      data-slot="last-verified"
      dateTime={iso}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      <Clock className="size-3" aria-hidden />
      Verified {text}
    </time>
  )
}

export { LastVerified }
