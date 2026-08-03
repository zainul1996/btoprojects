# Finance scenarios

The project-page affordability workspace produces planning scenarios, not
eligibility decisions. Its deterministic calculations live in
`src/lib/finance/`; there is deliberately no finance database table.

## Assumption set

Current version: `sg-housing-2026-08-03-release-b`, effective 3 Aug 2026.

- HDB and financial-institution (FI) scenarios use a maximum 75% LTV and a
  25-year term.
- HDB uses the current 2.6% concessionary rate (reviewed quarterly) for the
  actual payment scenario, 30% MSR, no minimum cash when CPF OA is sufficient,
  and no TDSR.
- FI defaults to an editable, illustrative 3.0% rate. It retains a 5% minimum
  cash requirement, 30% MSR and 55% TDSR including user-entered monthly debt.
- MSR and TDSR use an assessment instalment rather than the estimated actual
  payment: the higher of the actual rate or 3.0% for HDB loans, and the higher
  of the entered/illustrative rate or 4.0% for FI loans. These outputs describe
  assessment requirements and do not decide eligibility.
- An optional grant scenario defaults to zero and is capped at S$120,000. It
  does not assert EHG eligibility. The grant offsets non-cash upfront first,
  then reduces loan principal; it never offsets FI minimum cash.
- Residential BSD uses marginal rates effective 15 Feb 2023, is floored to
  the dollar, and applies the official S$1 minimum to positive values.

The version, effective dates and URLs are declared alongside the constants in
`src/lib/finance/assumptions.ts`. When an official rule changes, add a new
versioned assumption set rather than silently changing the meaning of old
scenario output.

## Official sources

- [HDB — Credit to finance a flat purchase](https://www.hdb.gov.sg/residential/buying-a-flat/working-out-your-flat-budget/credit-to-finance-a-flat-purchase)
- [HDB — Plan your finances](https://www.hdb.gov.sg/residential/buying-a-flat/buying-procedure-for-new-flats/timeline/plan-your-finances)
- [HDB — Housing loan from HDB](https://www.hdb.gov.sg/buying-a-flat/flat-grant-and-loan-eligibility/housing-loan/housing-loan-from-hdb)
- [HDB — Enhanced CPF Housing Grant](https://www.hdb.gov.sg/buying-a-flat/flat-grant-and-loan-eligibility/couples-and-families/enhanced-cpf-housing-grant)
- [MAS — Calculating TDSR for property loans](https://www.mas.gov.sg/regulation/explainers/tdsr-for-property-loans/calculating-tdsr)
- [IRAS — Buyer's Stamp Duty](https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer%27s-stamp-duty-(bsd))

Users must rely on their HFE letter for assessed grants, loan amount and
household eligibility.
