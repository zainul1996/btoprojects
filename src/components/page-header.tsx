import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageHeaderProps = ComponentProps<"header"> & {
  /** Breadcrumb trail slot, rendered above the title. */
  breadcrumb?: ReactNode
  title: string
  /** One-line muted summary under the title. */
  lede?: string
}

function PageHeader({
  breadcrumb,
  title,
  lede,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("space-y-3 py-8 md:py-12", className)}
      {...props}
    >
      {breadcrumb ? (
        <nav
          aria-label="Breadcrumb"
          className="text-sm text-muted-foreground [&_a]:text-muted-foreground [&_a]:hover:text-teal-deep"
        >
          {breadcrumb}
        </nav>
      ) : null}
      <h1>{title}</h1>
      {lede ? (
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
          {lede}
        </p>
      ) : null}
    </header>
  )
}

export { PageHeader }
