import type { Metadata } from "next";
import { BookmarkIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LastVerified } from "@/components/last-verified";
import { LifecycleChip } from "@/components/lifecycle-chip";
import { PageHeader } from "@/components/page-header";
import { Price } from "@/components/price";
import { Section } from "@/components/section";
import { SourceBadge } from "@/components/source-badge";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";

export const metadata: Metadata = {
  title: "Design system — internal",
  robots: { index: false },
};

const SWATCHES: { name: string; className: string; value: string }[] = [
  { name: "background · paper", className: "bg-paper", value: "oklch(0.972 0.008 92)" },
  { name: "card · surface", className: "bg-surface", value: "oklch(0.988 0.005 92)" },
  { name: "foreground · ink", className: "bg-ink", value: "oklch(0.235 0.018 264)" },
  { name: "primary · navy", className: "bg-primary", value: "oklch(0.315 0.048 259)" },
  { name: "secondary", className: "bg-secondary", value: "oklch(0.93 0.012 258)" },
  { name: "muted", className: "bg-muted", value: "oklch(0.945 0.009 92)" },
  { name: "accent · teal-subtle", className: "bg-accent", value: "oklch(0.935 0.028 187)" },
  { name: "teal", className: "bg-teal", value: "oklch(0.6 0.1 187)" },
  { name: "teal-deep", className: "bg-teal-deep", value: "oklch(0.5 0.088 187)" },
  { name: "teal-deeper", className: "bg-teal-deeper", value: "oklch(0.435 0.06 187)" },
  { name: "destructive · coral", className: "bg-destructive", value: "oklch(0.5 0.125 32)" },
  { name: "coral-subtle", className: "bg-coral-subtle", value: "oklch(0.945 0.02 32)" },
  { name: "border", className: "bg-border", value: "oklch(0.905 0.011 92)" },
  { name: "input", className: "bg-input", value: "oklch(0.878 0.013 92)" },
  { name: "ring · teal", className: "bg-ring", value: "oklch(0.6 0.1 187)" },
];

const CHART_SWATCHES = [
  { name: "chart-1 · navy", className: "bg-chart-1" },
  { name: "chart-2 · teal", className: "bg-chart-2" },
  { name: "chart-3", className: "bg-chart-3" },
  { name: "chart-4", className: "bg-chart-4" },
  { name: "chart-5", className: "bg-chart-5" },
];

const FLAT_TYPES = [
  { label: "2-room Flexi", value: "2-room" },
  { label: "3-room", value: "3-room" },
  { label: "4-room", value: "4-room" },
  { label: "5-room", value: "5-room" },
  { label: "3Gen", value: "3gen" },
];

function Swatch({ name, className, value }: { name: string; className: string; value?: string }) {
  return (
    <div className="space-y-1.5">
      <div className={`h-14 rounded-lg border border-border/60 ${className}`} />
      <p className="text-xs font-medium text-ink">{name}</p>
      {value ? (
        <p className="text-[11px] text-muted-foreground">{value}</p>
      ) : null}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 md:px-6">
      <PageHeader
        breadcrumb={<span>Internal QA</span>}
        title="Design system"
        lede="Tokens, trust primitives and shell for BTOProjects.sg. Not linked in navigation."
      />

      <Section title="Colour" description="Every colour is a token — no ad-hoc values in components.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {SWATCHES.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {CHART_SWATCHES.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </Section>

      <Section title="Typography" description="Inter. Large headings track slightly tight; numerals are tabular.">
        <div className="space-y-4 rounded-xl border bg-card p-6">
          <h1>Heading 1 — Tengah Garden Walk</h1>
          <h2>Heading 2 — Price range</h2>
          <h3>Heading 3 — Nearby schools</h3>
          <h4>Heading 4 — Site observations</h4>
          <p className="text-sm">
            Body copy — 4-room flats from <Price value={420000} className="inline" />{" "}
            with an estimated wait of 4 years. Facts are labelled, estimates are
            marked, and analysis is always attributed.
          </p>
          <p className="text-sm text-muted-foreground">
            Muted — used for supporting context, never for primary facts.
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Without tnum: </span>420000
            <span className="ml-6 text-muted-foreground">With tnum: </span>
            <span className="tnum">420000</span>
          </p>
        </div>
      </Section>

      <Section
        title="Trust badges"
        description="Fact vs. interpretation is never ambiguous — official, estimated and analysis differ by icon, fill and border, not colour alone."
      >
        <div className="flex flex-wrap items-center gap-3">
          <SourceBadge variant="official" size="sm" />
          <SourceBadge variant="estimated" size="sm" />
          <SourceBadge variant="analysis" size="sm" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SourceBadge variant="official" size="md" />
          <SourceBadge variant="estimated" size="md" />
          <SourceBadge variant="analysis" size="md" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <LastVerified date={new Date(2026, 7, 2)} />
          <LastVerified date="2026-06-15" />
          <LastVerified date={1749866400000} />
        </div>
      </Section>

      <Section title="Lifecycle chips" description="Announced and launched share the teal family but differ by dot fill.">
        <div className="flex flex-wrap items-center gap-3">
          <LifecycleChip stage="announced" />
          <LifecycleChip stage="launched" />
          <LifecycleChip stage="construction" />
          <LifecycleChip stage="sbf" />
          <LifecycleChip stage="mop" />
        </div>
      </Section>

      <Section title="Data display" description="Stats and prices are display elements — large, semibold, tabular.">
        <div className="grid grid-cols-2 gap-6 rounded-xl border bg-card p-6 md:grid-cols-4">
          <Stat label="From (4-room)" value={<Price value={420000} />} note="Official price list" />
          <Stat label="Units" value="1,240" note="All flat types" />
          <Stat label="Est. wait" value="~4 yrs" note="Analysis, from TOP trend" />
          <Stat label="Town median" value={<Price value={585000} approx />} note="Resale, last 6 months" />
        </div>
        <div className="flex flex-wrap items-baseline gap-6 text-sm">
          <Price value={420000} />
          <Price value={1288000} />
          <Price value={585000} approx />
          <Price value={98500} approx className="text-muted-foreground" />
        </div>
      </Section>

      <Section title="Buttons" description="One primary action per screen; secondary actions stay quiet.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Apply for this launch</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Flag conflict</Button>
          <Button variant="link">Read methodology</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Bookmark">
            <BookmarkIcon />
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Base badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="ghost">Ghost</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="link">Link</Badge>
        </div>
      </Section>

      <Section title="Card" description="One idea per card, generous padding, trust signals attached to facts.">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Tengah Garden Walk
              <LifecycleChip stage="launched" />
            </CardTitle>
            <CardDescription>Tengah · Jun 2026 launch · 4-room from S$420,000</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <SourceBadge variant="official" size="sm" />
              <LastVerified date="2026-07-28" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="From (4-room)" value={<Price value={420000} />} />
              <Stat label="Est. wait" value="~4 yrs" note="Analysis" />
            </div>
            <div className="flex gap-2">
              <Button size="sm">View project</Button>
              <Button size="sm" variant="outline">
                Compare
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Empty state" description="Teaches what this is and what to do next, in one line.">
        <EmptyState
          icon={BookmarkIcon}
          title="No projects in your watchlist yet"
          hint="Follow a project to get alerts when HDB updates it."
          action={<Button size="sm">Browse upcoming launches</Button>}
        />
      </Section>

      <Section title="Form primitives">
        <div className="max-w-md space-y-6 rounded-xl border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="budget">Household budget</Label>
            <Input id="budget" type="text" inputMode="numeric" placeholder="S$650,000" className="tnum" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flat-type">Flat type</Label>
            <Select items={FLAT_TYPES} defaultValue="4-room">
              <SelectTrigger id="flat-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLAT_TYPES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Price range</Label>
            <Slider
              aria-label="Price range"
              min={200000}
              max={1200000}
              step={10000}
              defaultValue={[400000, 650000]}
            />
            <p className="flex justify-between text-xs text-muted-foreground">
              <Price value={400000} approx />
              <Price value={650000} approx />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="alerts" defaultChecked />
            <Label htmlFor="alerts">Email me when this launch updates</Label>
          </div>
        </div>
      </Section>

      <Section title="Skeleton">
        <div className="max-w-md space-y-3 rounded-xl border bg-card p-6">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </Section>
    </div>
  );
}
