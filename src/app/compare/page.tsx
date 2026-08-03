import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../convex/_generated/api";
import { CompareWorkspace } from "@/components/compare/compare-workspace";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Compare BTO and SBF options",
  description:
    "Compare Singapore HDB BTO projects and SBF town pools side by side, with clear sale-type and data-availability context.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string | string[] }>;
}) {
  const { p } = await searchParams;
  const raw = Array.isArray(p) ? p.join(",") : (p ?? "");
  const slugs = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  // Server-side fetch so shared compare links render the real table on
  // first paint instead of a client skeleton.
  const summaries = slugs.length ? await fetchQuery(api.projects.list, {}) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 md:px-6">
      <PageHeader
        title="Compare"
        lede="Compare BTO projects and SBF town pools across price, wait, location and restrictions."
      />
      <CompareWorkspace slugs={slugs} summaries={summaries} />
    </div>
  );
}
