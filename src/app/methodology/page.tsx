import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { Card, CardContent } from "@/components/ui/card";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Housing data and source methodology",
  description:
    "How BTOProjects.sg uses HDB, data.gov.sg and OneMap information, labels estimates and keeps a source trail for Singapore housing decisions.",
  path: "/methodology",
});

const methodologyJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "BTOProjects.sg housing data and source methodology",
  url: absoluteUrl("/methodology"),
  description:
    "Source, attribution and confidence-label policy for BTOProjects.sg.",
  isPartOf: { "@id": `${absoluteUrl("/")}#website` },
};

const SOURCES = [
  {
    name: "Housing & Development Board",
    href: "https://www.hdb.gov.sg",
    use: "BTO and SBF exercise announcements, application information and official housing guidance.",
  },
  {
    name: "HDB Flat Portal",
    href: "https://homes.hdb.gov.sg",
    use: "Launch details and application-rate files for project or town-pool supply.",
  },
  {
    name: "data.gov.sg",
    href: "https://data.gov.sg",
    use: "Open government datasets, including HDB resale transaction records used for local comparisons.",
  },
  {
    name: "OneMap by Singapore Land Authority",
    href: "https://www.onemap.gov.sg",
    use: "Singapore place and geocoding information used for location context. OneMap is not the displayed basemap.",
  },
] as const;

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 md:px-6">
      <JsonLd id="methodology-schema" data={methodologyJsonLd} />
      <PageHeader
        breadcrumb={<Link href="/">Home</Link>}
        title="Housing data and source methodology"
        lede="We keep official records, estimates and our analysis separate so you can see what each decision rests on."
      />

      <Section
        title="How information is labelled"
        description="The label describes the evidence behind a value, not how important it is."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-3 p-5">
              <SourceBadge variant="official" />
              <p className="text-sm text-muted-foreground">
                Published by a government source such as HDB, data.gov.sg or
                OneMap. We retain the source URL and retrieval date.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <SourceBadge variant="estimated" />
              <p className="text-sm text-muted-foreground">
                Derived from available information when an official value has
                not been published. The estimate stays clearly marked.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <SourceBadge variant="analysis" />
              <p className="text-sm text-muted-foreground">
                Our interpretation of sourced facts, used to explain fit and
                trade-offs. It is not an official statement or prediction.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        title="Primary public sources"
        description="Project pages link to the records used for their facts."
      >
        <div className="grid gap-3">
          {SOURCES.map((source) => (
            <Card key={source.href}>
              <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:justify-between">
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
                  Visit source
                  <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
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
        </div>
      </Section>

      <Section title="What to verify before applying">
        <Card>
          <CardContent className="space-y-3 p-5 md:p-6">
            <p className="text-sm text-muted-foreground">
              BTOProjects.sg is independent and is not affiliated with HDB.
              Exercise dates, eligibility, prices and available flats can
              change. Check the HDB Flat Portal and your HFE letter before
              making an application or financing decision.
            </p>
            <Link
              href="/explore"
              className="inline-flex text-sm font-medium text-teal-deep hover:underline"
            >
              Explore BTO projects and SBF town pools →
            </Link>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
