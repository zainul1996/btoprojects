import { cva, type VariantProps } from "class-variance-authority"
import { ChartLine, Info, ShieldCheck } from "lucide-react"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/**
 * Trust primitive (DESIGN.md §4): every fact on the platform is labelled
 * official / estimated / analysis. Variants differ by icon, fill and border —
 * never by colour alone.
 */
const sourceBadgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full border font-medium whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        official: "border-teal-deep/25 bg-teal-subtle text-teal-deeper",
        estimated: "border-border bg-muted text-muted-foreground",
        analysis: "border-navy/40 bg-transparent text-navy",
      },
      size: {
        sm: "px-1.5 text-[11px] [&_svg]:size-3",
        md: "px-2 text-xs [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "official",
      size: "md",
    },
  }
)

const SOURCE_META = {
  official: { icon: ShieldCheck, label: "Official" },
  estimated: { icon: Info, label: "Estimated" },
  analysis: { icon: ChartLine, label: "Analysis" },
} as const

export type SourceBadgeVariant = keyof typeof SOURCE_META

function SourceBadge({
  className,
  variant = "official",
  size,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof sourceBadgeVariants>) {
  const { icon: Icon, label } = SOURCE_META[variant ?? "official"]
  return (
    <span
      data-slot="source-badge"
      data-variant={variant}
      className={cn(sourceBadgeVariants({ variant, size }), className)}
      {...props}
    >
      <Icon aria-hidden />
      <span>{label}</span>
    </span>
  )
}

export { SourceBadge, sourceBadgeVariants }
