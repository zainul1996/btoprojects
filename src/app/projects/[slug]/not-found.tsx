import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
      <EmptyState
        icon={SearchX}
        title="We don't track a project by that name"
        hint="It may not have launched yet, or the link has changed. Browse every project we follow."
        action={
          <Button render={<Link href="/projects" />} nativeButton={false}>
            Browse all projects
          </Button>
        }
      />
    </div>
  );
}
