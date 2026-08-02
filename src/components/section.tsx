import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type SectionProps = ComponentProps<"section"> & {
  title?: string
  description?: string
  children: ReactNode
}

/** Consistent section rhythm: clear heading, breathing room. */
function Section({
  title,
  description,
  children,
  className,
  ...props
}: SectionProps) {
  return (
    <section
      data-slot="section"
      className={cn("space-y-4 py-6 md:space-y-5 md:py-8", className)}
      {...props}
    >
      {title || description ? (
        <div className="space-y-1">
          {title ? <h2>{title}</h2> : null}
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export { Section }
