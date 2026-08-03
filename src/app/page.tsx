import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  Scale,
} from "lucide-react";

import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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
    href: "/explore?sale=bto&view=list",
    action: "Browse BTO projects",
  },
  {
    title: "Sale of Balance Flats (SBF)",
    description:
      "Balance flats offered in town pools. Flat types, locations and completion stages can vary within each pool.",
    href: "/explore?sale=sbf&view=list",
    action: "Browse SBF town pools",
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
      <section className="grid items-center gap-8 px-4 pt-10 pb-10 md:grid-cols-[minmax(0,1fr)_minmax(24rem,0.78fr)] md:gap-12 md:px-6 md:pt-20 md:pb-16">
        <div>
          <p className="text-sm font-medium text-teal-deep">
            BTO and SBF project guide
          </p>
          <h1 className="mt-3 max-w-2xl">
            Find an HDB home that fits your plans
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            Compare prices, locations and waiting times before deciding what to
            apply for.
          </p>
        </div>

        <section
          aria-labelledby="ai-planner-title"
          className="rounded-xl border border-border bg-surface px-5 py-5 md:px-6 md:py-6"
        >
          <h2
            id="ai-planner-title"
            className="font-heading text-xl leading-snug font-semibold md:text-2xl"
          >
            Ask the AI Planner
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ask about BTO and SBF projects, prices, locations, waiting times or
            flat rules.
          </p>

          <form action="/planner" method="get" className="mt-5">
            <InputGroup className="h-12 bg-background">
              <InputGroupInput
                name="prompt"
                aria-label="Question for the AI Planner"
                placeholder="Ask BTO or SBF"
                maxLength={500}
                required
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="default" size="sm">
                  Ask
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <BookOpenCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Answers use cited project data. Recommendations currently cover BTO
            launches.
          </p>
          <nav
            aria-label="Other ways to explore"
            className="mt-4 flex flex-wrap gap-x-5 border-t border-border pt-2"
          >
            <Link
              href="/explore"
              className="inline-flex min-h-11 items-center text-sm font-medium text-teal-deep hover:underline"
            >
              Find projects
            </Link>
            <Link
              href="/upcoming"
              className="inline-flex min-h-11 items-center text-sm font-medium text-teal-deep hover:underline"
            >
              See launch dates
            </Link>
          </nav>
        </section>
      </section>

      <Section
        title="Understand what you can apply for"
        description="Explore both HDB sales routes without treating unlike options as identical."
        className="border-t border-border px-4 md:px-6"
      >
        <div className="grid border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:divide-border">
          {HOME_TYPES.map((type) => (
            <article
              key={type.title}
              className="flex flex-col gap-2 border-b border-border px-1 py-5 last:border-b-0 sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:pr-0"
            >
              <h3 className="font-heading text-base leading-snug font-semibold">
                {type.title}
              </h3>
              <p className="text-sm text-muted-foreground">{type.description}</p>
              <Link
                href={type.href}
                className="mt-auto w-fit pt-1 text-sm font-medium text-teal-deep hover:underline"
              >
                {type.action}
                <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
              </Link>
            </article>
          ))}
        </div>
      </Section>

      <Section className="px-4 md:px-6">
        <div className="grid gap-5 border-l-2 border-teal px-4 py-2 md:grid-cols-[1fr_auto] md:items-center md:px-5">
          <div className="flex gap-3.5">
            <Scale className="mt-0.5 size-5 shrink-0 text-teal-deep" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold">
                Save projects and compare them
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Save projects as you browse, then compare their prices, waiting
                times and locations in one view.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8 md:pl-0">
            <Link
              href="/compare"
              className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
            >
              Compare projects
            </Link>
            <Link
              href="/watchlist"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-teal-deep hover:underline"
            >
              <Bell className="size-4" aria-hidden />
              Saved &amp; alerts
            </Link>
          </div>
        </div>
      </Section>

      <Section
        title="Common BTO and SBF questions"
        description="A short guide to the sales routes and how we label housing information."
        className="border-t border-border px-4 md:px-6"
      >
        <dl className="grid border-y border-border md:grid-cols-2">
          {HOME_FAQS.map((faq) => (
            <div
              key={faq.question}
              className="border-b border-border py-5 last:border-b-0 md:px-5 md:[&:nth-child(even)]:border-l md:[&:nth-child(even)]:pr-0 md:[&:nth-child(odd)]:pl-0 md:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <dt className="font-heading text-sm leading-snug font-semibold text-ink">
                {faq.question}
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
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
