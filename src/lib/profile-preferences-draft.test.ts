import { describe, expect, it } from "vitest";

import {
  PREFERENCES_DRAFT_KEY,
  clearPreferencesDraft,
  readPreferencesDraft,
  writePreferencesDraft,
  type PreferencesDraft,
} from "./profile-preferences-draft";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const draft: PreferencesDraft = {
  owner: "user-a",
  form: {
    budget: "550000",
    waitMonths: "48",
    flatTypes: ["4-room"],
    towns: "Tampines",
    regions: ["East"],
    workplaces: [],
  },
  workplaceInput: "1 Raffles Place",
  parentsInput: "520201",
  pendingMatch: {
    kind: "workplace",
    address: "ONE RAFFLES PLACE, 1 RAFFLES PLACE SINGAPORE 048616",
    lat: 1.2841,
    lng: 103.851,
  },
  baselineUpdatedAt: 100,
  savedAt: 200,
};

describe("preference session draft storage", () => {
  it("round-trips raw address inputs and a pending OneMap match", () => {
    const storage = new MemoryStorage();
    writePreferencesDraft(draft, storage);

    expect(readPreferencesDraft("user-a", storage)).toEqual(draft);
  });

  it("purges a draft belonging to a different owner", () => {
    const storage = new MemoryStorage();
    writePreferencesDraft(draft, storage);

    expect(readPreferencesDraft("user-b", storage)).toBeNull();
    expect(storage.getItem(PREFERENCES_DRAFT_KEY)).toBeNull();
  });

  it("purges ownerless and invalid drafts", () => {
    for (const value of [
      { ...draft, owner: undefined },
      { ...draft, workplaceInput: 123 },
      { ...draft, pendingMatch: { kind: "workplace", address: "x" } },
      "{not-json",
    ]) {
      const storage = new MemoryStorage();
      storage.setItem(
        PREFERENCES_DRAFT_KEY,
        typeof value === "string" ? value : JSON.stringify(value),
      );
      expect(readPreferencesDraft("user-a", storage)).toBeNull();
      expect(storage.getItem(PREFERENCES_DRAFT_KEY)).toBeNull();
    }
  });

  it("clears a stored draft", () => {
    const storage = new MemoryStorage();
    writePreferencesDraft(draft, storage);
    clearPreferencesDraft(storage);

    expect(readPreferencesDraft("user-a", storage)).toBeNull();
  });
});
