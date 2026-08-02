import type { LucideIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type EmptyStateProps = ComponentProps<"div"> & {
  icon: LucideIcon
  /** One line: what this space is. */
  title: string
  /** One line: what to do next. */
  hint?: string
  action?: ReactNode
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      <div className="grid size-12 place-items-center rounded-full bg-teal-subtle text-teal-deeper">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? (
        <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
      ) : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
