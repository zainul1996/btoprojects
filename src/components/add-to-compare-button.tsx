"use client";

import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCompare } from "@/components/compare-tray";
import { COMPARE_MAX } from "@/lib/compare";

type AddToCompareButtonProps = {
  slug: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline";
  className?: string;
};

export function AddToCompareButton({
  slug,
  label,
  size = "sm",
  variant = "outline",
  className,
}: AddToCompareButtonProps) {
  const { add, remove, has } = useCompare();
  const added = has(slug);

  return (
    <Button
      type="button"
      size={size}
      variant={added ? "secondary" : variant}
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
        const ok = add(slug, label);
        if (!ok) {
          toast(`You can compare up to ${COMPARE_MAX} projects`, {
            description: "Remove one from the tray to add another.",
          });
        }
      }}
    >
      {added ? (
        <>
          <Check data-icon="inline-start" aria-hidden />
          Added
        </>
      ) : (
        <>
          <Plus data-icon="inline-start" aria-hidden />
          Compare
        </>
      )}
    </Button>
  );
}
