export type HdbSaleKind = "bto" | "sbf";

export interface HdbAlertFact {
  field: string;
  value: string;
}

export interface HdbPreviousAlertFact {
  field: string;
  value: string | null;
}

export interface HdbProjectAlertInput {
  kind: HdbSaleKind;
  projectName: string;
  townName: string;
  exerciseLabel: string;
  changedFacts: readonly HdbAlertFact[];
}

export interface HdbProjectAlertCopy {
  title: string;
  body: string;
}

const APPLICANTS_FIELD = /^flatType\..+\.applicants$/;
const SUPPLY_FIELD = /^(?:totalUnits|flatType\..+\.units)$/;

export function isAlertWorthyHdbFact(field: string): boolean {
  return (
    APPLICANTS_FIELD.test(field) ||
    SUPPLY_FIELD.test(field) ||
    field === "applicationDeadline"
  );
}

function formatCount(value: number): string {
  return Number.isFinite(value)
    ? Math.round(value).toLocaleString("en-SG")
    : value.toString();
}

function flatTypeFrom(field: string, suffix: string): string | null {
  const match = new RegExp(`^flatType\\.(.+)\\.${suffix}$`).exec(field);
  return match?.[1] ?? null;
}

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b1;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function buildHdbEventKey(input: {
  projectId: string;
  exerciseKey: string;
  sourceUrl: string;
  previousFacts: readonly HdbPreviousAlertFact[];
  facts: readonly HdbAlertFact[];
}): string {
  const previousSnapshot = input.previousFacts
    .filter((fact) => isAlertWorthyHdbFact(fact.field))
    .map((fact) => [fact.field, fact.value] as const)
    .sort(([fieldA], [fieldB]) =>
      fieldA < fieldB ? -1 : fieldA > fieldB ? 1 : 0,
    );
  const nextSnapshot = input.facts
    .filter((fact) => isAlertWorthyHdbFact(fact.field))
    .map((fact) => [fact.field, fact.value] as const)
    .sort(([fieldA], [fieldB]) =>
      fieldA < fieldB ? -1 : fieldA > fieldB ? 1 : 0,
    );
  const identity = JSON.stringify([
    input.projectId,
    input.exerciseKey,
    input.sourceUrl,
    previousSnapshot,
    nextSnapshot,
  ]);
  return `hdb:${input.projectId}:${input.exerciseKey}:${stableHash(identity)}`;
}

function changedApplicants(facts: readonly HdbAlertFact[]): string[] {
  return facts.flatMap((fact) => {
    const flatType = flatTypeFrom(fact.field, "applicants");
    return flatType
      ? [`${flatType} (${formatCount(Number(fact.value))})`]
      : [];
  });
}

function changedSupply(facts: readonly HdbAlertFact[]): string[] {
  return facts.flatMap((fact) => {
    if (fact.field === "totalUnits") {
      return [`total (${formatCount(Number(fact.value))} units)`];
    }
    const flatType = flatTypeFrom(fact.field, "units");
    return flatType
      ? [`${flatType} (${formatCount(Number(fact.value))} units)`]
      : [];
  });
}

function deadlineChange(facts: readonly HdbAlertFact[]): string | null {
  return (
    facts.find((fact) => fact.field === "applicationDeadline")?.value ?? null
  );
}

/**
 * Copy for one combined project-level alert. The caller decides recipients;
 * this helper only reports official fields present in the parsed HDB file.
 */
export function buildHdbProjectAlert(
  input: HdbProjectAlertInput,
): HdbProjectAlertCopy | null {
  const changedFacts = input.changedFacts.filter((fact) =>
    isAlertWorthyHdbFact(fact.field),
  );
  if (changedFacts.length === 0) return null;

  const subject =
    input.kind === "sbf"
      ? `${input.townName} SBF town pool`
      : `${input.projectName} BTO project`;
  const applicants = changedApplicants(changedFacts);
  const supply = changedSupply(changedFacts);
  const deadline = deadlineChange(changedFacts);
  const changes = [
    ...(applicants.length > 0
      ? [`Applicant counts changed: ${applicants.join(", ")}.`]
      : []),
    ...(supply.length > 0
      ? [`Supply changed: ${supply.join(", ")}.`]
      : []),
    ...(deadline ? [`Application deadline changed to ${deadline}.`] : []),
  ];

  return {
    title:
      input.kind === "sbf"
        ? `Official SBF town-pool update: ${input.townName}`
        : `Official BTO project update: ${input.projectName}`,
    body:
      `HDB published an official update for the ${subject} in the ${input.exerciseLabel} exercise. ` +
      `${changes.join(" ")} View details.`,
  };
}
