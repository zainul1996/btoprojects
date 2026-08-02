"use client";

import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCompare } from "@/components/compare-tray";
import { COMPARE_MAX } from "@/lib/compare";

type AddToCompareButtonProps = {
  slug: string;
  size?: "sm" | "default";
  className?: string;
};

export function AddToCompareButton({ slug, size = "sm", className }: AddToCompareButtonProps) {
  const { add, remove, has } = useCompare();
  const added = has(slug);

  return (
    <Button
      type="button"
      size={size}
      variant={added ? "secondary" : "outline"}
      className={className}
      aria-pressed={added}
      onClick={(event) => {
        // Cards are wrapped in links — never let the button navigate.
        event.preventDefault();
        event.stopPropagation();
        if (added) {
          remove(slug);
          return;
        }
        const ok = add(slug);
        if (!ok) {
          toast(`You can compare up to ${COMPARE_MAX} projects`, {
            description: "Remove one from the tray to add another.",
          });
        }
      }}
    >
      {added ? (
        <>
          <Check className="size-3.5 text-teal-deep" aria-hidden />
          Added
        </>
      ) : (
        <>
          <Plus className="size-3.5" aria-hidden />
          Compare
        </>
      )}
    </Button>
  );
}
