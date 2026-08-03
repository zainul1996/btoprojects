export type FinanceSource = {
  label: string;
  url: string;
  verifiedDate: string;
};

export type BsdTier = {
  upperBound: number | null;
  rate: number;
};

export type FinanceAssumptions = {
  version: string;
  effectiveDate: string;
  loanTermYears: number;
  maximumLtv: number;
  totalDownpaymentShare: number;
  msrLimit: number;
  hdb: {
    annualInterestRate: number;
    assessmentAnnualInterestRateFloor: number;
    minimumCashShare: number;
    tdsrApplies: false;
  };
  financialInstitution: {
    illustrativeAnnualInterestRate: number;
    assessmentAnnualInterestRateFloor: number;
    minimumCashShare: number;
    tdsrLimit: number;
  };
  ehg: {
    scenarioCap: number;
  };
  bsd: {
    effectiveDate: string;
    tiers: readonly BsdTier[];
  };
  sources: readonly FinanceSource[];
};

/**
 * Versioned policy inputs for deterministic scenario calculations.
 *
 * Rates are decimal shares (2.6% = 0.026). This is code, rather than stored
 * user data, so a historical scenario can continue to name the assumptions
 * that produced it after policy inputs change.
 */
export const FINANCE_ASSUMPTIONS_2026 = {
  version: "sg-housing-2026-08-03-release-b",
  effectiveDate: "2026-08-03",
  loanTermYears: 25,
  maximumLtv: 0.75,
  totalDownpaymentShare: 0.25,
  msrLimit: 0.3,
  hdb: {
    annualInterestRate: 0.026,
    assessmentAnnualInterestRateFloor: 0.03,
    minimumCashShare: 0,
    tdsrApplies: false,
  },
  financialInstitution: {
    illustrativeAnnualInterestRate: 0.03,
    assessmentAnnualInterestRateFloor: 0.04,
    minimumCashShare: 0.05,
    tdsrLimit: 0.55,
  },
  ehg: {
    scenarioCap: 120_000,
  },
  bsd: {
    effectiveDate: "2023-02-15",
    tiers: [
      { upperBound: 180_000, rate: 0.01 },
      { upperBound: 360_000, rate: 0.02 },
      { upperBound: 1_000_000, rate: 0.03 },
      { upperBound: 1_500_000, rate: 0.04 },
      { upperBound: 3_000_000, rate: 0.05 },
      { upperBound: null, rate: 0.06 },
    ] satisfies readonly BsdTier[],
  },
  sources: [
    {
      label: "HDB — Credit to finance a flat purchase",
      url: "https://www.hdb.gov.sg/residential/buying-a-flat/working-out-your-flat-budget/credit-to-finance-a-flat-purchase",
      verifiedDate: "2026-08-03",
    },
    {
      label: "HDB — Plan your finances",
      url: "https://www.hdb.gov.sg/residential/buying-a-flat/buying-procedure-for-new-flats/timeline/plan-your-finances",
      verifiedDate: "2026-08-03",
    },
    {
      label: "HDB — Housing loan from HDB",
      url: "https://www.hdb.gov.sg/buying-a-flat/flat-grant-and-loan-eligibility/housing-loan/housing-loan-from-hdb",
      verifiedDate: "2026-08-03",
    },
    {
      label: "HDB — Enhanced CPF Housing Grant",
      url: "https://www.hdb.gov.sg/buying-a-flat/flat-grant-and-loan-eligibility/couples-and-families/enhanced-cpf-housing-grant",
      verifiedDate: "2026-08-03",
    },
    {
      label: "MAS — Calculating TDSR for property loans",
      url: "https://www.mas.gov.sg/regulation/explainers/tdsr-for-property-loans/calculating-tdsr",
      verifiedDate: "2026-08-03",
    },
    {
      label: "IRAS — Buyer's Stamp Duty",
      url: "https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer%27s-stamp-duty-(bsd)",
      verifiedDate: "2026-08-03",
    },
  ],
} as const satisfies FinanceAssumptions;
