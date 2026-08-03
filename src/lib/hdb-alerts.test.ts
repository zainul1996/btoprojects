import { describe, expect, it } from "vitest";

import {
  buildHdbEventKey,
  buildHdbProjectAlert,
  isAlertWorthyHdbFact,
} from "../../convex/ingest/hdbAlerts";

const base = {
  kind: "bto" as const,
  projectName: "Example Grove",
  townName: "Bedok",
  exerciseLabel: "June 2026 BTO",
};

describe("HDB project alert outbox helpers", () => {
  it("recognises only demand, supply and deadline facts", () => {
    expect(isAlertWorthyHdbFact("flatType.4-room.applicants")).toBe(true);
    expect(isAlertWorthyHdbFact("flatType.4-room.units")).toBe(true);
    expect(isAlertWorthyHdbFact("totalUnits")).toBe(true);
    expect(isAlertWorthyHdbFact("applicationDeadline")).toBe(true);
    expect(isAlertWorthyHdbFact("classification")).toBe(false);
  });

  it("returns no copy for an unchanged batch", () => {
    expect(buildHdbProjectAlert({ ...base, changedFacts: [] })).toBeNull();
  });

  it("reports only the flat type whose applicant count changed", () => {
    const alert = buildHdbProjectAlert({
      ...base,
      changedFacts: [
        { field: "flatType.4-room.applicants", value: "1234" },
      ],
    });

    expect(alert?.body).toContain(
      "Applicant counts changed: 4-room (1,234).",
    );
    expect(alert?.body).not.toContain("Supply changed");
    expect(alert?.body).not.toContain("deadline changed");
    expect(alert?.body).toContain("View details.");
  });

  it("reports a deadline-only change without unrelated data", () => {
    const alert = buildHdbProjectAlert({
      ...base,
      changedFacts: [
        { field: "applicationDeadline", value: "2026-06-24" },
      ],
    });

    expect(alert?.body).toContain(
      "Application deadline changed to 2026-06-24.",
    );
    expect(alert?.body).not.toContain("Applicant counts changed");
    expect(alert?.body).not.toContain("Supply changed");
  });

  it("uses the complete canonical snapshot for a stable event key", () => {
    const input = {
      projectId: "project123",
      exerciseKey: "2026-06",
      sourceUrl: "https://example.test/BTO202606.json",
      previousFacts: [
        { field: "flatType.4-room.units", value: "500" },
        { field: "flatType.4-room.applicants", value: "1200" },
      ],
      facts: [
        { field: "flatType.4-room.units", value: "500" },
        { field: "classification", value: "Standard" },
        { field: "flatType.4-room.applicants", value: "1234" },
      ],
    };
    const reordered = {
      ...input,
      previousFacts: [...input.previousFacts].reverse(),
      facts: [...input.facts].reverse(),
    };

    expect(buildHdbEventKey(input)).toBe(buildHdbEventKey(reordered));
    expect(
      buildHdbEventKey({
        ...input,
        facts: input.facts.map((fact) =>
          fact.field.endsWith(".applicants")
            ? { ...fact, value: "1235" }
            : fact,
        ),
      }),
    ).not.toBe(buildHdbEventKey(input));
  });

  it("distinguishes a snapshot reversion from the original transition", () => {
    const identity = {
      projectId: "project123",
      exerciseKey: "2026-06",
      sourceUrl: "https://example.test/BTO202606.json",
    };
    const a = [{ field: "flatType.4-room.applicants", value: "1200" }];
    const b = [{ field: "flatType.4-room.applicants", value: "1234" }];

    const aToB = buildHdbEventKey({
      ...identity,
      previousFacts: a,
      facts: b,
    });
    const bToA = buildHdbEventKey({
      ...identity,
      previousFacts: b,
      facts: a,
    });

    expect(aToB).not.toBe(bToA);
    expect(
      buildHdbEventKey({ ...identity, previousFacts: a, facts: b }),
    ).toBe(aToB);
  });
});
