import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CircleDollarSign,
  House,
  LockKeyhole,
  MapPin,
  Scale,
} from "lucide-react";

import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { buttonVariants } from "@/components/ui/button";
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

const PLANNING_INPUTS = [
  {
    icon: CircleDollarSign,
    label: "Budget",
    hint: "Include grants if relevant",
  },
  {
    icon: House,
    label: "Flat type",
    hint: "Choose the sizes that work",
  },
  {
    icon: MapPin,
    label: "Preferred towns",
    hint: "Add the places you would consider",
  },
  {
    icon: CalendarClock,
    label: "Move-in timing",
    hint: "Share when you hope to collect keys",
  },
] as const;

const PLANNER_START_PROMPT =
  "Help me build a shortlist. Ask me about my budget, flat type, preferred towns and when I hope to collect the keys.";

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

        <section
          aria-labelledby="planning-brief-title"
          className="rounded-xl border border-border bg-surface px-5 py-5 md:px-6 md:py-6"
        >
          <h2
            id="planning-brief-title"
            className="font-heading text-xl leading-snug font-semibold md:text-2xl"
          >
            Your HDB planning brief
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The planner asks four things before it ranks suitable BTO projects.
          </p>

          <ul className="mt-4 divide-y divide-border" aria-label="Planning inputs">
            {PLANNING_INPUTS.map(({ icon: Icon, label, hint }) => (
              <li
                key={label}
                className="grid min-h-15 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-3 py-3 md:grid-cols-[1.25rem_8.5rem_minmax(0,1fr)]"
              >
                <Icon className="size-5 text-teal-deep" aria-hidden />
                <span className="text-sm font-medium text-ink">{label}</span>
                <span className="col-start-2 text-xs text-muted-foreground md:col-start-3 md:text-right md:text-sm">
                  {hint}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href={`/planner?prompt=${encodeURIComponent(PLANNER_START_PROMPT)}`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-4 min-h-11 w-full",
            )}
          >
            Build my shortlist
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Link>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            The planner uses your answers and cited project data. SBF search is
            included.
          </p>
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
                Shortlist first, compare second
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Select projects as you browse, then compare their price,
                timeline and location in one view.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8 md:pl-0">
            <Link
              href="/compare"
              className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
            >
              Compare shortlist
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
