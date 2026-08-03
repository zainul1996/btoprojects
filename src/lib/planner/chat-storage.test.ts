import { describe, expect, it } from "vitest";

import {
  CHAT_STORAGE_KEY,
  identityTransitionMode,
  readStoredChat,
  writeStoredChat,
} from "./chat-storage";

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

function writeFor(owner: string | null, storage: Storage): void {
  writeStoredChat(
    {
      owner,
      messages: [],
      constraints: { budgetMax: 500_000 },
      sessionId: null,
      input: "",
      savedAt: 1,
    },
    storage,
  );
}

describe("planner sessionStorage ownership", () => {
  it("only preserves local state when anonymous becomes signed in", () => {
    expect(identityTransitionMode(null, "user-a")).toBe("rebind");
    expect(identityTransitionMode("user-a", "user-b")).toBe("clear");
    expect(identityTransitionMode("user-a", null)).toBe("clear");
  });

  it("restores state for the same signed-in owner", () => {
    const storage = new MemoryStorage();
    writeFor("user-a", storage);
    expect(readStoredChat("user-a", storage)?.owner).toBe("user-a");
  });

  it("rejects and removes a different signed-in owner's state", () => {
    const storage = new MemoryStorage();
    writeFor("user-a", storage);
    expect(readStoredChat("user-b", storage)).toBeNull();
    expect(storage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("rejects anonymous and signed-in state across the boundary", () => {
    const signedStorage = new MemoryStorage();
    writeFor("user-a", signedStorage);
    expect(readStoredChat(null, signedStorage)).toBeNull();

    const anonymousStorage = new MemoryStorage();
    writeFor(null, anonymousStorage);
    expect(readStoredChat("user-a", anonymousStorage)).toBeNull();
  });

  it("rejects an ownerless v2 envelope", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        messages: [],
        constraints: { budgetMax: 500_000 },
        sessionId: null,
        input: "",
        savedAt: 1,
      }),
    );
    expect(readStoredChat("user-a", storage)).toBeNull();
    expect(storage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });
});
