import Link from "next/link";
import { Fragment } from "react";

import { prettifySlug } from "@/lib/compare";

const CITATION_PATTERN = /(\[[a-z0-9][a-z0-9-]*\])/g;
const SINGLE_CITATION = /^\[([a-z0-9][a-z0-9-]*)\]$/;

/**
 * Renders planner reply text with [slug] citations as inline project links.
 * Slugs the backend didn't confirm stay plain text — no uncited claims, no
 * broken links (DESIGN.md AI rules).
 */
export function CitedText({
  text,
  citedSlugs,
}: {
  text: string;
  citedSlugs: string[];
}) {
  const known = new Set(citedSlugs);
  const parts = text.split(CITATION_PATTERN);

  return (
    <>
      {parts.map((part, i) => {
        const match = SINGLE_CITATION.exec(part);
        const slug = match?.[1];
        if (!slug || !known.has(slug)) {
          return <Fragment key={i}>{part}</Fragment>;
        }
        return (
          <Link
            key={i}
            href={`/projects/${slug}`}
            className="font-semibold text-teal-deep hover:underline"
          >
            {prettifySlug(slug)}
          </Link>
        );
      })}
    </>
  );
}
