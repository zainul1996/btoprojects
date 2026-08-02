"use client";

import Link from "next/link";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CITATION_PATTERN = /\[([a-z0-9][a-z0-9-]*)\]/g;

/**
 * Turns backend-confirmed [slug] citations into real links before Markdown
 * rendering. Slugs the backend didn't confirm stay literal text, so an
 * invented citation can never become a broken or misleading link
 * (DESIGN.md AI rules).
 */
function linkifyCitations(
  text: string,
  cited: Map<string, string>,
): string {
  return text.replace(CITATION_PATTERN, (whole, slug: string) => {
    const name = cited.get(slug);
    return name ? `[${name}](/projects/${slug})` : whole;
  });
}

export const PlannerMarkdown = memo(function PlannerMarkdown({
  text,
  citedSlugs,
}: {
  text: string;
  /** Map of confirmed slug → display name (from this turn's rankings). */
  citedSlugs: Map<string, string>;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) =>
          href?.startsWith("/") ? (
            <Link
              href={href}
              className="font-semibold text-teal-deep hover:underline"
            >
              {children}
            </Link>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-teal-deep hover:underline"
            >
              {children}
            </a>
          ),
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-ink">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">
            {children}
          </ol>
        ),
      }}
    >
      {linkifyCitations(text, citedSlugs)}
    </ReactMarkdown>
  );
});
