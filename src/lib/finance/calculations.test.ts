import { describe, expect, it } from "vitest";

import {
  amortiseLoan,
  calculateBsd,
  calculateFinanceScenario,
} from "./calculations";

describe("amortiseLoan", () => {
  it("calculates a fixed-rate amortising loan", () => {
    const result = amortiseLoan(300_000, 0.026, 25);

    expect(result.monthlyInstalment).toBeCloseTo(1_361.01, 2);
    expect(result.totalPayment).toBeCloseTo(
      result.monthlyInstalment * 300,
      8,
    );
    expect(result.totalInterest).toBeCloseTo(
      result.totalPayment - 300_000,
      8,
    );
  });

  it("handles a zero interest rate without division by zero", () => {
    expect(amortiseLoan(300_000, 0, 25)).toEqual({
      monthlyInstalment: 1_000,
      totalPayment: 300_000,
      totalInterest: 0,
    });
  });
});

describe("calculateFinanceScenario", () => {
  it("uses 75% LTV, no minimum cash, and the 3% HDB assessment floor", () => {
    const result = calculateFinanceScenario({
      price: 400_000,
      loanKind: "hdb",
    });

    expect(result.annualInterestRate).toBe(0.026);
    expect(result.upfront).toMatchObject({
      requiredBeforeGrant: 100_000,
      minimumCash: 0,
      cpfOrCash: 100_000,
      buyerFundsExcludingBsd: 100_000,
    });
    expect(result.loan.maximumLtv).toBe(0.75);
    expect(result.loan.principal).toBe(300_000);
    expect(result.loan.monthlyInstalment).toBeCloseTo(
      amortiseLoan(300_000, 0.026, 25).monthlyInstalment,
    );
    expect(result.assessment.annualInterestRateFloor).toBe(0.03);
    expect(result.assessment.annualInterestRate).toBe(0.03);
    expect(result.assessment.monthlyInstalment).toBeCloseTo(
      amortiseLoan(300_000, 0.03, 25).monthlyInstalment,
    );
    expect(result.requirements.msr.minimumMonthlyIncome).toBeCloseTo(
      result.assessment.monthlyInstalment / 0.3,
    );
  });

  it("preserves 5% minimum cash and uses the 4% FI assessment floor", () => {
    const result = calculateFinanceScenario({
      price: 400_000,
      loanKind: "financial-institution",
      annualInterestRate: 0.03,
    });

    expect(result.upfront).toMatchObject({
      requiredBeforeGrant: 100_000,
      minimumCash: 20_000,
      cpfOrCash: 80_000,
      buyerFundsExcludingBsd: 100_000,
    });
    expect(result.loan.principal).toBe(300_000);
    expect(result.loan.monthlyInstalment).toBeCloseTo(
      amortiseLoan(300_000, 0.03, 25).monthlyInstalment,
    );
    expect(result.assessment.annualInterestRateFloor).toBe(0.04);
    expect(result.assessment.annualInterestRate).toBe(0.04);
    expect(result.assessment.monthlyInstalment).toBeCloseTo(
      amortiseLoan(300_000, 0.04, 25).monthlyInstalment,
    );
  });

  it("uses an entered FI rate above the assessment floor", () => {
    const result = calculateFinanceScenario({
      price: 400_000,
      loanKind: "financial-institution",
      annualInterestRate: 0.045,
    });

    expect(result.annualInterestRate).toBe(0.045);
    expect(result.assessment.annualInterestRateFloor).toBe(0.04);
    expect(result.assessment.annualInterestRate).toBe(0.045);
    expect(result.assessment.monthlyInstalment).toBeCloseTo(
      result.loan.monthlyInstalment,
    );
  });

  it("applies a grant to non-cash upfront then the loan", () => {
    const hdb = calculateFinanceScenario({
      price: 400_000,
      loanKind: "hdb",
      grantAmount: 120_000,
    });
    const fi = calculateFinanceScenario({
      price: 400_000,
      loanKind: "financial-institution",
      grantAmount: 120_000,
    });

    expect(hdb.upfront).toMatchObject({
      minimumCash: 0,
      cpfOrCash: 0,
      grantAppliedToUpfront: 100_000,
      grantAppliedToLoan: 20_000,
    });
    expect(hdb.loan.principal).toBe(280_000);

    expect(fi.upfront).toMatchObject({
      minimumCash: 20_000,
      cpfOrCash: 0,
      grantAppliedToUpfront: 80_000,
      grantAppliedToLoan: 40_000,
      buyerFundsExcludingBsd: 20_000,
    });
    expect(fi.loan.principal).toBe(260_000);
  });

  it("uses the assessment instalment and other debt for FI TDSR", () => {
    const result = calculateFinanceScenario({
      price: 400_000,
      loanKind: "financial-institution",
      annualInterestRate: 0.03,
      householdMonthlyIncome: 6_000,
      otherMonthlyDebt: 500,
    });
    const assessmentMonthly = result.assessment.monthlyInstalment;

    expect(result.requirements.msr.minimumMonthlyIncome).toBeCloseTo(
      assessmentMonthly / 0.3,
    );
    expect(result.requirements.msr.ratio).toBeCloseTo(
      assessmentMonthly / 6_000,
    );
    expect(result.requirements.msr.monthlyHeadroom).toBeCloseTo(
      6_000 * 0.3 - assessmentMonthly,
    );
    expect(result.requirements.tdsr?.minimumMonthlyIncome).toBeCloseTo(
      (assessmentMonthly + 500) / 0.55,
    );
    expect(result.requirements.tdsr?.ratio).toBeCloseTo(
      (assessmentMonthly + 500) / 6_000,
    );
    expect(result.requirements.tdsr?.monthlyHeadroom).toBeCloseTo(
      6_000 * 0.55 - assessmentMonthly - 500,
    );
  });

  it("retains negative headroom when commitments exceed a ratio limit", () => {
    const result = calculateFinanceScenario({
      price: 400_000,
      loanKind: "financial-institution",
      householdMonthlyIncome: 3_000,
      otherMonthlyDebt: 1_000,
    });

    expect(result.requirements.msr.monthlyHeadroom).toBeLessThan(0);
    expect(result.requirements.tdsr?.monthlyHeadroom).toBeLessThan(0);
  });

  it("rejects grant scenarios above the published cap", () => {
    expect(() =>
      calculateFinanceScenario({
        price: 400_000,
        loanKind: "hdb",
        grantAmount: 120_001,
      }),
    ).toThrow(/cannot exceed 120000/);
  });
});

describe("calculateBsd", () => {
  it.each([
    [0, 0],
    [0.01, 1],
    [1, 1],
    [99, 1],
    [99.99, 1],
    [100, 1],
    [180_000, 1_800],
    [180_001, 1_800],
    [360_000, 5_400],
    [360_001, 5_400],
    [1_000_000, 24_600],
    [1_000_001, 24_600],
    [1_500_000, 44_600],
    [1_500_001, 44_600],
    [3_000_000, 119_600],
    [3_000_001, 119_600],
    [4_000_000, 179_600],
  ])("floors BSD at the tier boundary for S$%i", (price, expected) => {
    expect(calculateBsd(price)).toBe(expected);
  });
});
