import {
  FINANCE_ASSUMPTIONS_2026,
  type FinanceAssumptions,
} from "./assumptions";

export type LoanKind = "hdb" | "financial-institution";

export type Amortisation = {
  monthlyInstalment: number;
  totalPayment: number;
  totalInterest: number;
};

export type FinanceScenarioInput = {
  price: number;
  loanKind: LoanKind;
  annualInterestRate?: number;
  grantAmount?: number;
  householdMonthlyIncome?: number;
  otherMonthlyDebt?: number;
};

export type RatioRequirement = {
  limit: number;
  minimumMonthlyIncome: number;
  ratio: number | null;
  monthlyHeadroom: number | null;
};

export type FinanceScenario = {
  assumptionVersion: string;
  assumptionsEffectiveDate: string;
  loanKind: LoanKind;
  price: number;
  annualInterestRate: number;
  loanTermYears: number;
  bsd: number;
  grantAmount: number;
  upfront: {
    requiredBeforeGrant: number;
    minimumCash: number;
    cpfOrCash: number;
    grantAppliedToUpfront: number;
    grantAppliedToLoan: number;
    buyerFundsExcludingBsd: number;
  };
  loan: {
    maximumLtv: number;
    maximumPrincipalBeforeGrant: number;
    principal: number;
    monthlyInstalment: number;
    totalPayment: number;
    totalInterest: number;
  };
  assessment: {
    annualInterestRateFloor: number;
    annualInterestRate: number;
    monthlyInstalment: number;
  };
  requirements: {
    msr: RatioRequirement;
    tdsr: RatioRequirement | null;
    otherMonthlyDebt: number;
  };
};

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite, non-negative number`);
  }
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero`);
  }
}

export function amortiseLoan(
  principal: number,
  annualInterestRate: number,
  years: number,
): Amortisation {
  assertFiniteNonNegative(principal, "principal");
  assertFiniteNonNegative(annualInterestRate, "annualInterestRate");
  assertPositive(years, "years");

  const numberOfPayments = years * 12;
  if (!Number.isInteger(numberOfPayments)) {
    throw new RangeError("years must resolve to a whole number of months");
  }

  const monthlyRate = annualInterestRate / 12;
  const monthlyInstalment =
    monthlyRate === 0
      ? principal / numberOfPayments
      : (principal * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -numberOfPayments));
  const totalPayment = monthlyInstalment * numberOfPayments;

  return {
    monthlyInstalment,
    totalPayment,
    totalInterest: Math.max(0, totalPayment - principal),
  };
}

export function calculateBsd(
  propertyValue: number,
  assumptions: FinanceAssumptions = FINANCE_ASSUMPTIONS_2026,
): number {
  assertFiniteNonNegative(propertyValue, "propertyValue");

  let duty = 0;
  let lowerBound = 0;
  for (const tier of assumptions.bsd.tiers) {
    const upperBound = tier.upperBound ?? propertyValue;
    const amountInTier = Math.max(
      0,
      Math.min(propertyValue, upperBound) - lowerBound,
    );
    duty += amountInTier * tier.rate;
    if (propertyValue <= upperBound) break;
    lowerBound = upperBound;
  }

  if (propertyValue === 0) return 0;
  return Math.max(1, Math.floor(duty));
}

function ratioRequirement(
  monthlyCommitment: number,
  limit: number,
  householdMonthlyIncome: number | undefined,
): RatioRequirement {
  return {
    limit,
    minimumMonthlyIncome: monthlyCommitment / limit,
    ratio:
      householdMonthlyIncome === undefined
        ? null
        : monthlyCommitment / householdMonthlyIncome,
    monthlyHeadroom:
      householdMonthlyIncome === undefined
        ? null
        : householdMonthlyIncome * limit - monthlyCommitment,
  };
}

/**
 * Produces a financing scenario, not an eligibility decision.
 *
 * The optional grant is applied to the non-cash portion of the downpayment
 * first. Any remainder reduces the loan principal. It never offsets an FI
 * loan's minimum cash requirement.
 */
export function calculateFinanceScenario(
  input: FinanceScenarioInput,
  assumptions: FinanceAssumptions = FINANCE_ASSUMPTIONS_2026,
): FinanceScenario {
  assertPositive(input.price, "price");
  const grantAmount = input.grantAmount ?? 0;
  const otherMonthlyDebt = input.otherMonthlyDebt ?? 0;
  assertFiniteNonNegative(grantAmount, "grantAmount");
  assertFiniteNonNegative(otherMonthlyDebt, "otherMonthlyDebt");
  if (grantAmount > assumptions.ehg.scenarioCap) {
    throw new RangeError(
      `grantAmount cannot exceed ${assumptions.ehg.scenarioCap}`,
    );
  }
  if (input.householdMonthlyIncome !== undefined) {
    assertPositive(input.householdMonthlyIncome, "householdMonthlyIncome");
  }

  const isHdb = input.loanKind === "hdb";
  const annualInterestRate = isHdb
    ? assumptions.hdb.annualInterestRate
    : (input.annualInterestRate ??
      assumptions.financialInstitution.illustrativeAnnualInterestRate);
  assertFiniteNonNegative(annualInterestRate, "annualInterestRate");

  const requiredBeforeGrant =
    input.price * assumptions.totalDownpaymentShare;
  const minimumCash =
    input.price *
    (isHdb
      ? assumptions.hdb.minimumCashShare
      : assumptions.financialInstitution.minimumCashShare);
  const nonCashUpfront = requiredBeforeGrant - minimumCash;
  const grantAppliedToUpfront = Math.min(grantAmount, nonCashUpfront);
  const grantAppliedToLoan = Math.max(
    0,
    grantAmount - grantAppliedToUpfront,
  );
  const cpfOrCash = Math.max(0, nonCashUpfront - grantAppliedToUpfront);
  const maximumPrincipalBeforeGrant =
    input.price * assumptions.maximumLtv;
  const principal = Math.max(
    0,
    maximumPrincipalBeforeGrant - grantAppliedToLoan,
  );
  const amortisation = amortiseLoan(
    principal,
    annualInterestRate,
    assumptions.loanTermYears,
  );
  const assessmentAnnualInterestRateFloor = isHdb
    ? assumptions.hdb.assessmentAnnualInterestRateFloor
    : assumptions.financialInstitution.assessmentAnnualInterestRateFloor;
  const assessmentAnnualInterestRate = Math.max(
    annualInterestRate,
    assessmentAnnualInterestRateFloor,
  );
  const assessmentAmortisation = amortiseLoan(
    principal,
    assessmentAnnualInterestRate,
    assumptions.loanTermYears,
  );
  const msr = ratioRequirement(
    assessmentAmortisation.monthlyInstalment,
    assumptions.msrLimit,
    input.householdMonthlyIncome,
  );
  const tdsr = isHdb
    ? null
    : ratioRequirement(
        assessmentAmortisation.monthlyInstalment + otherMonthlyDebt,
        assumptions.financialInstitution.tdsrLimit,
        input.householdMonthlyIncome,
      );

  return {
    assumptionVersion: assumptions.version,
    assumptionsEffectiveDate: assumptions.effectiveDate,
    loanKind: input.loanKind,
    price: input.price,
    annualInterestRate,
    loanTermYears: assumptions.loanTermYears,
    bsd: calculateBsd(input.price, assumptions),
    grantAmount,
    upfront: {
      requiredBeforeGrant,
      minimumCash,
      cpfOrCash,
      grantAppliedToUpfront,
      grantAppliedToLoan,
      buyerFundsExcludingBsd: minimumCash + cpfOrCash,
    },
    loan: {
      maximumLtv: assumptions.maximumLtv,
      maximumPrincipalBeforeGrant,
      principal,
      ...amortisation,
    },
    assessment: {
      annualInterestRateFloor: assessmentAnnualInterestRateFloor,
      annualInterestRate: assessmentAnnualInterestRate,
      monthlyInstalment: assessmentAmortisation.monthlyInstalment,
    },
    requirements: {
      msr,
      tdsr,
      otherMonthlyDebt,
    },
  };
}
