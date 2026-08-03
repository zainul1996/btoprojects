import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { FINANCE_ASSUMPTIONS_2026 } from "@/lib/finance/assumptions";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Housing data and source methodology",
  description:
    "How BTOProjects.sg uses HDB, data.gov.sg and OneMap records, labels estimates and explains its Singapore housing affordability scenarios.",
  path: "/methodology",
});

const methodologyJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "BTOProjects.sg housing data and source methodology",
  url: absoluteUrl("/methodology"),
  description:
    "Source, attribution, confidence-label and affordability-method policy for BTOProjects.sg.",
  dateModified: FINANCE_ASSUMPTIONS_2026.effectiveDate,
  inLanguage: "en-SG",
  isPartOf: { "@id": `${absoluteUrl("/")}#website` },
};

const SOURCES = [
  {
    name: "Housing & Development Board",
    linkLabel: "HDB",
    href: "https://www.hdb.gov.sg",
    use: "BTO and SBF exercise announcements, application information and official housing guidance.",
  },
  {
    name: "HDB Flat Portal",
    linkLabel: "HDB Flat Portal",
    href: "https://homes.hdb.gov.sg",
    use: "Launch details and application-rate files for project or town-pool supply.",
  },
  {
    name: "data.gov.sg",
    linkLabel: "data.gov.sg",
    href: "https://data.gov.sg",
    use: "Open government datasets, including HDB resale transaction records used for local comparisons.",
  },
  {
    name: "OneMap by Singapore Land Authority",
    linkLabel: "OneMap",
    href: "https://www.onemap.gov.sg",
    use: "Singapore place and geocoding information used for location context. OneMap is not the displayed basemap.",
  },
] as const;

const financeEffectiveDate = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Singapore",
}).format(new Date(`${FINANCE_ASSUMPTIONS_2026.effectiveDate}T00:00:00+08:00`));

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 md:px-6">
      <JsonLd id="methodology-schema" data={methodologyJsonLd} />
      <PageHeader
        breadcrumb={<Link href="/">Home</Link>}
        title="Housing data and source methodology"
        lede={`We label official records, estimates and our analysis separately. Methodology reviewed ${financeEffectiveDate}.`}
      />

      <Section
        title="How information is labelled"
        description="The label describes the evidence behind a value, not how important it is."
      >
        <dl className="grid gap-5 rounded-xl bg-muted/45 p-5 md:grid-cols-3 md:p-6">
          <div className="flex flex-col gap-3">
            <dt>
              <SourceBadge variant="official" />
            </dt>
            <dd className="text-sm text-muted-foreground">
              Published by a government source such as HDB, data.gov.sg or
              OneMap. We retain the source URL and retrieval date.
            </dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt>
              <SourceBadge variant="estimated" />
            </dt>
            <dd className="text-sm text-muted-foreground">
              Derived from available information when an official value has
              not been published. The estimate stays clearly marked.
            </dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt>
              <SourceBadge variant="analysis" />
            </dt>
            <dd className="text-sm text-muted-foreground">
              Our interpretation of sourced facts, used to explain fit and
              trade-offs. It is not an official statement or prediction.
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        title="Primary public sources"
        description="Project pages link to the records used for their facts."
      >
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {SOURCES.map((source) => (
            <li
              key={source.href}
              className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {source.name}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {source.use}
                </p>
              </div>
              <a
                href={source.href}
                target="_blank"
                rel="noopener"
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal-deep hover:underline"
              >
                Visit {source.linkLabel}
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <aside className="border-l-2 border-teal bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <p>
            Resale comparisons contain information from the HDB Resale flat
            prices dataset, accessed through data.gov.sg. Each source record
            carries its access date. The dataset is made available under the{" "}
            <a
              href="https://data.gov.sg/open-data-licence"
              target="_blank"
              rel="noopener"
              className="font-medium text-teal-deep hover:underline"
            >
              Singapore Open Data Licence version 1.0
            </a>
            .
          </p>
        </aside>
      </Section>

      <Section
        title="How affordability scenarios work"
        description="The figures help with early planning. They are not an eligibility decision, loan offer or financial advice."
      >
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
            <p>
              Project pages compare an HDB loan scenario with an illustrative
              financial-institution loan scenario. Each calculation uses the
              published project price and a versioned set of policy inputs.
            </p>
            <p>
              The result can include estimated downpayment, monthly mortgage,
              Buyer&apos;s Stamp Duty and an optional grant input. It does not
              assess your household&apos;s eligibility or replace an HFE letter.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Current assumptions are dated{" "}
            <time dateTime={FINANCE_ASSUMPTIONS_2026.effectiveDate}>
              {financeEffectiveDate}
            </time>
            . Check the official guidance before making a financing decision.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {FINANCE_ASSUMPTIONS_2026.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-sm font-medium text-teal-deep hover:underline"
                >
                  {source.label}
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="What to verify before applying">
        <aside className="flex flex-col gap-3 border-l-2 border-coral bg-coral-subtle/50 p-5 md:p-6">
          <p className="text-sm text-muted-foreground">
            BTOProjects.sg is independent and is not affiliated with HDB.
            Exercise dates, eligibility, prices and available flats can
            change. Check the HDB Flat Portal and your HFE letter before
            making an application or financing decision.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-deep hover:underline"
          >
            Explore BTO projects and SBF town pools
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </aside>
      </Section>
    </div>
  );
}
