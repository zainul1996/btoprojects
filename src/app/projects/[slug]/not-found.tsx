import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
      <EmptyState
        icon={SearchX}
        headingLevel={1}
        title="Project page not found"
        hint="The project may not be in our current records, or its link may have changed."
        details={
          <p className="text-sm text-muted-foreground">
            Search the full project list to check recent BTO launches and SBF
            town pools.
          </p>
        }
        action={
          <Link href="/explore" className={buttonVariants()}>
            Search all projects
          </Link>
        }
      />
    </div>
  );
}
