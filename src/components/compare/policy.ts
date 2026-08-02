/**
 * HDB classification rules — policy facts (official), not estimates.
 * One shared wording so compare, planner and project pages never drift.
 */
export const CLASSIFICATION_POLICY: Record<
  "Standard" | "Plus" | "Prime",
  string
> = {
  Standard: "5-year MOP",
  Plus: "10-year MOP, subsidy clawback",
  Prime: "10-year MOP, subsidy clawback, resale to SC/PR households only",
};
