"use client";

import { useState, type ChangeEvent } from "react";

import { Price, formatSgd } from "@/components/price";
import { SourceBadge } from "@/components/source-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FINANCE_ASSUMPTIONS_2026 } from "@/lib/finance/assumptions";
import {
  calculateFinanceScenario,
  type FinanceScenario,
  type LoanKind,
} from "@/lib/finance/calculations";

import { formatIsoDate, type ProjectDetails } from "./utils";

const HFE_URL =
  "https://www.hdb.gov.sg/residential/buying-a-flat/working-out-your-flat-budget/credit-to-finance-a-flat-purchase";
const FI_GUIDANCE_URL =
  "https://www.hdb.gov.sg/residential/buying-a-flat/buying-procedure-for-new-flats/timeline/plan-your-finances";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

type ParsedInput = {
  value: number | undefined;
  error?: string;
};

function parseOptionalNonNegative(
  rawValue: string,
  errorMessage: string,
): ParsedInput {
  if (rawValue.trim() === "") return { value: undefined };
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    return { value: undefined, error: errorMessage };
  }
  return { value };
}

function NumericInput({
  id,
  label,
  value,
  onChange,
  hint,
  min = 0,
  max,
  step = 100,
  suffix,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  error?: string;
}) {
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className={suffix ? "pr-10" : undefined}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RatioReadout({
  title,
  requirement,
}: {
  title: string;
  requirement: FinanceScenario["requirements"]["msr"];
}) {
  const headroom = requirement.monthlyHeadroom;
  const exceedsLimit = headroom !== null && headroom < 0;

  return (
    <div
      className={`space-y-1 border-l-2 pl-3 ${
        exceedsLimit ? "border-destructive" : "border-border"
      }`}
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {requirement.ratio === null ? (
        <>
          <p className="tnum text-lg font-semibold text-ink">
            {formatSgd(requirement.minimumMonthlyIncome)}/mo
          </p>
          <p className="text-xs text-muted-foreground">
            Estimated minimum gross income at the {formatPercent(requirement.limit)}{" "}
            limit
          </p>
        </>
      ) : (
        <>
          <p className="tnum text-lg font-semibold text-ink">
            {formatPercent(requirement.ratio)}
          </p>
          <p
            className={
              exceedsLimit
                ? "text-xs font-medium text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {headroom === null
              ? ""
              : headroom < 0
                ? `Exceeds the ${formatPercent(requirement.limit)} limit by ${formatSgd(Math.abs(headroom))}/month`
                : headroom === 0
                  ? `At the ${formatPercent(requirement.limit)} limit`
                  : `${formatSgd(headroom)}/month headroom to the ${formatPercent(requirement.limit)} limit`}
          </p>
        </>
      )}
    </div>
  );
}

function ratioStatus(
  title: string,
  requirement: FinanceScenario["requirements"]["msr"],
): string {
  if (requirement.ratio === null || requirement.monthlyHeadroom === null) {
    return `${title}: estimated minimum income ${formatSgd(requirement.minimumMonthlyIncome)} per month.`;
  }
  const headroom = requirement.monthlyHeadroom;
  const position =
    headroom < 0
      ? `exceeds the ${formatPercent(requirement.limit)} limit by ${formatSgd(Math.abs(headroom))} per month`
      : headroom === 0
        ? `at the ${formatPercent(requirement.limit)} limit`
        : `${formatSgd(headroom)} per month headroom to the ${formatPercent(requirement.limit)} limit`;
  return `${title}: ${formatPercent(requirement.ratio)}, ${position}.`;
}

function assessmentInstalmentLabel(scenario: FinanceScenario): string {
  const floor = scenario.assessment.annualInterestRateFloor;
  return scenario.annualInterestRate <= floor
    ? `Assessment instalment at ${formatPercent(floor)} floor`
    : `Assessment instalment at ${formatPercent(scenario.assessment.annualInterestRate)} (above ${formatPercent(floor)} floor)`;
}

/**
 * Interactive, deterministic scenarios from published project from-prices.
 * Outputs describe financing requirements; they never decide HFE eligibility.
 */
export function Affordability({
  flatTypes,
}: {
  flatTypes: ProjectDetails["flatTypes"];
}) {
  const pricedFlatTypes = [...flatTypes]
    .filter((flat) => flat.minPrice > 0)
    .sort((a, b) => a.minPrice - b.minPrice);
  const [selectedType, setSelectedType] = useState<string>(
    pricedFlatTypes[0]?.type ?? "",
  );
  const [loanKind, setLoanKind] = useState<LoanKind>("hdb");
  const [fiRate, setFiRate] = useState("3");
  const [grant, setGrant] = useState("0");
  const [income, setIncome] = useState("");
  const [otherDebt, setOtherDebt] = useState("");

  const selected =
    pricedFlatTypes.find((flat) => flat.type === selectedType) ??
    pricedFlatTypes[0];
  if (!selected) return null;

  let fiRateInput: ParsedInput = { value: undefined };
  if (loanKind === "financial-institution") {
    fiRateInput =
      fiRate.trim() === ""
        ? {
            value: undefined,
            error: "Enter an illustrative FI interest rate.",
          }
        : parseOptionalNonNegative(
            fiRate,
            "Enter an FI interest rate of 0% or more.",
          );
  }

  let grantInput = parseOptionalNonNegative(
    grant,
    "Enter a grant scenario of S$0 or more.",
  );
  if (
    grantInput.value !== undefined &&
    grantInput.value > FINANCE_ASSUMPTIONS_2026.ehg.scenarioCap
  ) {
    grantInput = {
      value: undefined,
      error: "Grant scenarios are capped at S$120,000.",
    };
  }

  let incomeInput = parseOptionalNonNegative(
    income,
    "Enter monthly household income above S$0, or leave it blank.",
  );
  if (incomeInput.value === 0) {
    incomeInput = {
      value: undefined,
      error: "Enter monthly household income above S$0, or leave it blank.",
    };
  }
  const otherDebtInput: ParsedInput =
    loanKind === "financial-institution"
      ? parseOptionalNonNegative(
          otherDebt,
          "Enter other monthly debt of S$0 or more.",
        )
      : { value: undefined };

  const hasInputError = Boolean(
    fiRateInput.error ||
      grantInput.error ||
      incomeInput.error ||
      otherDebtInput.error,
  );
  let scenario: FinanceScenario | null = null;
  let calculationError: string | null = null;
  if (!hasInputError) {
    try {
      scenario = calculateFinanceScenario({
        price: selected.minPrice,
        loanKind,
        annualInterestRate:
          fiRateInput.value === undefined
            ? undefined
            : fiRateInput.value / 100,
        grantAmount: grantInput.value,
        householdMonthlyIncome: incomeInput.value,
        otherMonthlyDebt: otherDebtInput.value,
      });
    } catch {
      calculationError =
        "This scenario could not be calculated. Review the inputs and try again.";
    }
  }

  const activeAssumptions: string[] = [];
  if (grant.trim() !== "" && grantInput.value && grantInput.value > 0) {
    activeAssumptions.push(`Grant ${formatSgd(grantInput.value)}`);
  }
  if (income.trim() !== "" && incomeInput.value) {
    activeAssumptions.push(`Income ${formatSgd(incomeInput.value)}/mo`);
  }
  if (
    loanKind === "financial-institution" &&
    otherDebt.trim() !== "" &&
    otherDebtInput.value &&
    otherDebtInput.value > 0
  ) {
    activeAssumptions.push(`Debt ${formatSgd(otherDebtInput.value)}/mo`);
  }
  if (grantInput.error) activeAssumptions.push("Grant needs attention");
  if (incomeInput.error) activeAssumptions.push("Income needs attention");
  if (otherDebtInput.error) activeAssumptions.push("Debt needs attention");
  const optionalSummary =
    activeAssumptions.length > 0
      ? activeAssumptions.join(" · ")
      : "None added";

  return (
    <Card>
      <CardContent className="space-y-6 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">
              Build a financing scenario
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a published from-price, then adjust only what matters.
            </p>
          </div>
          <SourceBadge variant="estimated" size="sm" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="finance-flat-type">Flat type and from-price</Label>
            <select
              id="finance-flat-type"
              value={selected.type}
              onChange={(event) => setSelectedType(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {pricedFlatTypes.map((flat) => (
                <option key={flat._id} value={flat.type}>
                  {flat.type} · {formatSgd(flat.minPrice)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Official project from-price, before grants.
            </p>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Loan scenario</legend>
            <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
              {(
                [
                  ["hdb", "HDB loan"],
                  ["financial-institution", "FI loan"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="cursor-pointer rounded-md px-3 py-2 text-center text-sm has-checked:bg-background has-checked:font-medium has-checked:shadow-sm focus-within:ring-2 focus-within:ring-ring"
                >
                  <input
                    type="radio"
                    name="loan-kind"
                    value={value}
                    checked={loanKind === value}
                    onChange={() => setLoanKind(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Both scenarios use the published maximum 75% LTV.
            </p>
          </fieldset>
        </div>

        {loanKind === "financial-institution" ? (
          <div className="max-w-xs">
            <NumericInput
              id="finance-fi-rate"
              label="Illustrative FI interest rate"
              value={fiRate}
              onChange={(event) => setFiRate(event.target.value)}
              step={0.1}
              suffix="%"
              hint="Editable market assumption — 3.0% is not an official rate."
              error={fiRateInput.error}
            />
          </div>
        ) : null}

        <details className="group border-y border-border/60 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Optional assumptions
            <span className="ml-2 font-normal text-muted-foreground">
              — {optionalSummary}
            </span>
          </summary>
          <div
            className={`grid gap-5 pt-4 ${
              loanKind === "financial-institution"
                ? "sm:grid-cols-3"
                : "sm:grid-cols-2"
            }`}
          >
            <NumericInput
              id="finance-grant"
              label="Grant scenario"
              value={grant}
              onChange={(event) => setGrant(event.target.value)}
              max={FINANCE_ASSUMPTIONS_2026.ehg.scenarioCap}
              hint="Illustrative only, capped at S$120,000. Actual EHG depends on HFE; this is not an entitlement."
              error={grantInput.error}
            />
            <NumericInput
              id="finance-income"
              label="Gross household income / month"
              value={income}
              onChange={(event) => setIncome(event.target.value)}
              hint="Shows ratios and headroom instead of a verdict."
              error={incomeInput.error}
            />
            {loanKind === "financial-institution" ? (
              <NumericInput
                id="finance-other-debt"
                label="Other monthly debt"
                value={otherDebt}
                onChange={(event) => setOtherDebt(event.target.value)}
                hint="Included in the FI TDSR scenario."
                error={otherDebtInput.error}
              />
            ) : null}
          </div>
        </details>

        {calculationError ? (
          <p role="alert" className="text-sm text-destructive">
            {calculationError}
          </p>
        ) : scenario ? (
          <>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Buyer funds before BSD
                </p>
                <p className="mt-1 text-2xl font-semibold text-ink">
                  <Price value={scenario.upfront.buyerFundsExcludingBsd} approx />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {loanKind === "financial-institution"
                    ? `${formatSgd(scenario.upfront.minimumCash)} minimum cash · ${formatSgd(scenario.upfront.cpfOrCash)} CPF or cash`
                    : `${formatSgd(scenario.upfront.cpfOrCash)} CPF or cash · no minimum cash if CPF OA is sufficient`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Estimated actual monthly payment
                </p>
                <p className="mt-1 text-2xl font-semibold text-ink">
                  <Price value={scenario.loan.monthlyInstalment} approx />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scenario.loanTermYears} years ·{" "}
                  {(scenario.annualInterestRate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Buyer&apos;s Stamp Duty
                </p>
                <p className="mt-1 text-2xl font-semibold text-ink">
                  <Price value={scenario.bsd} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  IRAS residential marginal rates
                </p>
              </div>
            </div>

            <div className="grid gap-5 border-t border-border/60 pt-5 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/60 p-3 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {assessmentInstalmentLabel(scenario)}
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  <Price
                    value={scenario.assessment.monthlyInstalment}
                    approx
                  />
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Used for the MSR and TDSR estimates below, not as an
                  eligibility decision.
                </p>
              </div>
              <RatioReadout
                title="MSR assessment"
                requirement={scenario.requirements.msr}
              />
              {scenario.requirements.tdsr ? (
                <RatioReadout
                  title="TDSR assessment"
                  requirement={scenario.requirements.tdsr}
                />
              ) : (
                <div className="space-y-1 border-l-2 border-border pl-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    TDSR
                  </p>
                  <p className="text-sm font-medium text-ink">
                    Not applied to this HDB loan scenario
                  </p>
                </div>
              )}
            </div>
            <p
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {assessmentInstalmentLabel(scenario)}:{" "}
              {formatSgd(scenario.assessment.monthlyInstalment)} per month.{" "}
              {ratioStatus("MSR", scenario.requirements.msr)}{" "}
              {scenario.requirements.tdsr
                ? ratioStatus("TDSR", scenario.requirements.tdsr)
                : "TDSR does not apply to this HDB loan scenario."}
            </p>

            <details>
              <summary className="cursor-pointer text-sm font-medium text-teal-deep outline-none focus-visible:ring-2 focus-visible:ring-ring">
                See calculation breakdown
              </summary>
              <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">25% downpayment</dt>
                  <dd className="tnum">{formatSgd(scenario.upfront.requiredBeforeGrant)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Grant to upfront</dt>
                  <dd className="tnum">−{formatSgd(scenario.upfront.grantAppliedToUpfront)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Loan principal</dt>
                  <dd className="tnum">{formatSgd(scenario.loan.principal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Total interest</dt>
                  <dd className="tnum">{formatSgd(scenario.loan.totalInterest)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    Actual monthly payment
                  </dt>
                  <dd className="tnum">
                    {formatSgd(scenario.loan.monthlyInstalment)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {assessmentInstalmentLabel(scenario)}
                  </dt>
                  <dd className="tnum">
                    {formatSgd(scenario.assessment.monthlyInstalment)}
                  </dd>
                </div>
              </dl>
              {scenario.upfront.grantAppliedToLoan > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  After covering non-cash upfront,{" "}
                  {formatSgd(scenario.upfront.grantAppliedToLoan)} of the grant
                  scenario reduces the loan.
                </p>
              ) : null}
            </details>
          </>
        ) : null}

        <div className="rounded-lg bg-teal-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-teal-deeper">
                {loanKind === "hdb"
                  ? "Confirm with your HFE letter"
                  : "Confirm HFE and FI loan terms"}
              </p>
              <p className="mt-1 text-xs text-teal-deeper/80">
                {loanKind === "hdb"
                  ? "HDB officially assesses your grants and HDB loan amount through HFE."
                  : "HFE confirms flat and grant eligibility. Your FI’s IPA or Letter of Offer confirms its loan rate and terms."}
              </p>
            </div>
            <a
              href={
                loanKind === "hdb" ? HFE_URL : FI_GUIDANCE_URL
              }
              target="_blank"
              rel="noopener"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {loanKind === "hdb"
                ? "Check HFE guidance"
                : "Read official financing guidance"}
            </a>
          </div>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Assumptions and official sources
          </summary>
          <div className="mt-3 space-y-3">
            <p>
              Version {FINANCE_ASSUMPTIONS_2026.version} · effective{" "}
              {formatIsoDate(FINANCE_ASSUMPTIONS_2026.effectiveDate)}. HDB:
              2.6% (reviewed quarterly), 25 years, 30% MSR, and no minimum cash
              if CPF OA is sufficient. FI: editable rate, 5% minimum cash, 30%
              MSR and 55% TDSR including entered debt. Assessment instalments
              use the higher of the actual rate or a 3.0% HDB / 4.0% FI floor.
              BSD is floored to the dollar.
            </p>
            <ul className="space-y-1">
              {FINANCE_ASSUMPTIONS_2026.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener"
                    className="text-teal-deep underline-offset-2 hover:underline"
                  >
                    {source.label}
                  </a>{" "}
                  · verified {formatIsoDate(source.verifiedDate)}
                </li>
              ))}
            </ul>
            <p>
              Scenario only, not financial advice or an eligibility decision.
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
