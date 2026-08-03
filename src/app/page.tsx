import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Bot,
  CalendarDays,
  Map,
  Scale,
} from "lucide-react";

import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = createPageMetadata({
  title: "Singapore BTO and SBF project guide",
  description:
    "Plan around your budget and timeline, compare BTO projects and SBF town pools, and follow official HDB launch updates.",
  path: "/",
});

const HOME_TYPES = [
  {
    title: "Build-To-Order (BTO)",
    description:
      "Named projects launched with a location, flat mix and expected waiting time.",
  },
  {
    title: "Sale of Balance Flats (SBF)",
    description:
      "Balance flats offered in town pools. Flat types, locations and completion stages can vary within each pool.",
  },
] as const;

const HOME_FAQS = [
  {
    question: "What is an HDB BTO project?",
    answer:
      "Build-To-Order flats are new HDB homes launched in named projects. Each launch sets out the location, flat types, prices and expected completion timeline when those details are available.",
  },
  {
    question: "How is Sale of Balance Flats different from BTO?",
    answer:
      "Sale of Balance Flats offers unsold or returned flats from earlier exercises. HDB lists them by town and flat type, and the exact block, remaining lease, price and completion stage can vary by flat.",
  },
  {
    question: "Which information on BTOProjects.sg is official?",
    answer:
      "Facts from HDB, data.gov.sg and OneMap are labelled and linked to their source. Estimates and our analysis stay separate. BTOProjects.sg is independent and is not affiliated with HDB.",
  },
  {
    question: "Are the affordability figures an HDB eligibility result?",
    answer:
      "No. They are planning scenarios based on published HDB, MAS and IRAS rules. Your HFE letter and, where relevant, a financial institution determine your actual grant and loan eligibility.",
  },
] as const;

const homeFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  url: absoluteUrl("/"),
  mainEntity: HOME_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd id="home-faq-schema" data={homeFaqJsonLd} />
      <section className="grid items-center gap-8 px-4 pt-10 pb-10 md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] md:gap-12 md:px-6 md:pt-20 md:pb-16">
        <div>
          <p className="text-sm font-medium text-teal-deep">
            BTO and SBF decision support
          </p>
          <h1 className="mt-3 max-w-2xl">
            Find an HDB home that fits your plans
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            Work from your budget, timeline and preferred towns. See the
            trade-offs clearly before building a shortlist.
          </p>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="p-5 pb-3 md:p-6 md:pb-3">
            <div className="mb-2 grid size-10 place-items-center rounded-lg bg-teal-subtle text-teal-deeper">
              <Bot className="size-5" aria-hidden />
            </div>
            <h2 className="font-heading text-lg leading-snug font-semibold">
              Start with your needs
            </h2>
            <CardDescription>
              Get a ranked shortlist based on what matters to your household.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-2 md:p-6 md:pt-2">
            <Link
              href="/planner"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11 w-full")}
            >
              Plan with AI
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/explore"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-11 w-full px-2 text-xs sm:text-sm",
                )}
              >
                <Map aria-hidden />
                Explore projects
              </Link>
              <Link
                href="/upcoming"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "min-h-11 w-full px-2 text-xs sm:text-sm",
                )}
              >
                <CalendarDays aria-hidden />
                Launch calendar
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <Section
        title="Understand what you can apply for"
        description="Explore both HDB sales routes without treating unlike options as identical."
        className="border-t border-border px-4 md:px-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {HOME_TYPES.map((type) => (
            <Card key={type.title} size="sm">
              <CardHeader>
                <h3 className="font-heading text-sm leading-snug font-medium">
                  {type.title}
                </h3>
                <CardDescription>{type.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="px-4 md:px-6">
        <Card className="gap-0 bg-muted/50 py-0">
          <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
            <div className="flex gap-3.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-background text-navy ring-1 ring-foreground/10">
                <Scale className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  Shortlist first, compare second
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Select projects as you browse. The comparison tray keeps
                  their key trade-offs together; save places to follow changes
                  and receive alerts.
                </p>
              </div>
            </div>
            <Link
              href="/watchlist"
              className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
            >
              <Bell aria-hidden />
              Saved &amp; alerts
            </Link>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Common BTO and SBF questions"
        description="A short guide to the sales routes and how we label housing information."
        className="border-t border-border px-4 md:px-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {HOME_FAQS.map((faq) => (
            <Card key={faq.question} size="sm">
              <CardHeader>
                <h3 className="font-heading text-sm leading-snug font-medium">
                  {faq.question}
                </h3>
                <CardDescription>{faq.answer}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Read our{" "}
          <Link
            href="/methodology"
            className="font-medium text-teal-deep hover:underline"
          >
            data and source methodology
          </Link>{" "}
          for the full policy.
        </p>
      </Section>

      <section className="mt-4 border-t border-border bg-muted/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 md:flex-row md:items-center md:gap-6 md:px-6">
          <div>
            <p className="text-sm font-medium text-ink">
              Facts are sourced, dated and labelled.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Official records stay distinct from estimates and our analysis.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge variant="official" />
            <SourceBadge variant="estimated" />
            <SourceBadge variant="analysis" />
          </div>
        </div>
      </section>
    </div>
  );
}
