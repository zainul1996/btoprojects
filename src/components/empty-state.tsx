import type { LucideIcon } from "lucide-react"
import type { ComponentProps, ElementType, ReactNode } from "react"

import { cn } from "@/lib/utils"

type EmptyStateProps = ComponentProps<"div"> & {
  icon: LucideIcon
  /** What this space is. Keep it concrete and task-specific. */
  title: string
  /** What happened or what the user can do next. */
  hint?: string
  /** Optional task detail, such as steps or a compact feature summary. */
  details?: ReactNode
  action?: ReactNode
  /** Empty states sit below a page heading by default. */
  headingLevel?: 1 | 2 | 3
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  details,
  action,
  headingLevel = 2,
  className,
  ...props
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as ElementType

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col gap-5 rounded-xl border border-border bg-surface px-5 py-6 md:px-7 md:py-8",
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3.5">
        <Icon className="mt-0.5 size-5 shrink-0 text-teal-deep" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <Heading
            className={cn(
              "font-semibold text-ink",
              headingLevel === 1
                ? "text-2xl tracking-tight md:text-3xl"
                : "text-base md:text-lg"
            )}
          >
            {title}
          </Heading>
          {hint ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
      {details ? <div>{details}</div> : null}
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
