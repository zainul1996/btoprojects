import type { Metadata } from "next";

import { CompareWorkspace } from "@/components/compare/compare-workspace";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Compare BTO projects",
  description:
    "Side-by-side comparison of Singapore HDB BTO projects — price, wait, location, restrictions and what you give up.",
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

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 md:px-6">
      <PageHeader
        title="Compare"
        lede="Side by side: price, wait, location, restrictions — and what you give up."
      />
      <CompareWorkspace slugs={slugs} />
    </div>
  );
}
