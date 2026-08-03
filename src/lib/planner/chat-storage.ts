import type { Id } from "../../../convex/_generated/dataModel";
import type { PlannerConstraints } from "@/components/planner/ranking-card";
import type { PlannerUIMessage } from "@/lib/planner/types";

// Per-tab persistence: sessionStorage survives SPA navigation and reloads but
// dies with the tab, which matches the anonymous-session semantics we want.
const LEGACY_CHAT_STORAGE_KEY = "bto.planner.chat.v1";
const CHAT_STORAGE_KEY = "bto.planner.chat.v2";
const MAX_STORED_MESSAGES = 50;

export function identityTransitionMode(
  previousOwner: string | null,
  nextOwner: string | null,
): "rebind" | "clear" {
  return previousOwner === null && nextOwner !== null ? "rebind" : "clear";
}

export type StoredChat = {
  owner: string | null;
  messages: PlannerUIMessage[];
  constraints: PlannerConstraints;
  sessionId: Id<"plannerSessions"> | null;
  input: string;
  savedAt: number;
};

function isStoredMessage(value: unknown): value is PlannerUIMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" ||
      message.role === "assistant" ||
      message.role === "system") &&
    Array.isArray(message.parts)
  );
}

export function readStoredChat(
  expectedOwner: string | null,
  suppliedStorage?: Storage,
): StoredChat | null {
  const storage =
    suppliedStorage ??
    (typeof window === "undefined" ? undefined : window.sessionStorage);
  if (!storage) return null;
  try {
    // v1 could contain canonical saved addresses from the short-lived profile
    // seeding implementation. Never restore or retain that envelope.
    storage.removeItem(LEGACY_CHAT_STORAGE_KEY);
    const raw = storage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      storage.removeItem(CHAT_STORAGE_KEY);
      return null;
    }
    const envelope = parsed as Record<string, unknown>;
    if (
      !("owner" in envelope) ||
      (typeof envelope.owner !== "string" && envelope.owner !== null) ||
      envelope.owner !== expectedOwner
    ) {
      storage.removeItem(CHAT_STORAGE_KEY);
      return null;
    }
    return {
      owner: expectedOwner,
      messages: Array.isArray(envelope.messages)
        ? envelope.messages.filter(isStoredMessage).slice(-MAX_STORED_MESSAGES)
        : [],
      constraints:
        typeof envelope.constraints === "object"
          ? (envelope.constraints as PlannerConstraints)
          : null,
      sessionId:
        typeof envelope.sessionId === "string"
          ? (envelope.sessionId as Id<"plannerSessions">)
          : null,
      input: typeof envelope.input === "string" ? envelope.input : "",
      savedAt: typeof envelope.savedAt === "number" ? envelope.savedAt : 0,
    };
  } catch {
    try {
      storage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Storage can be entirely unavailable in privacy mode.
    }
    return null;
  }
}

export function writeStoredChat(
  chat: StoredChat,
  suppliedStorage?: Storage,
): void {
  const storage =
    suppliedStorage ??
    (typeof window === "undefined" ? undefined : window.sessionStorage);
  if (!storage) return;
  try {
    storage.removeItem(LEGACY_CHAT_STORAGE_KEY);
    if (
      chat.messages.length === 0 &&
      chat.constraints === null &&
      chat.sessionId === null &&
      chat.input.trim() === ""
    ) {
      storage.removeItem(CHAT_STORAGE_KEY);
      return;
    }
    storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chat));
  } catch {
    // Quota or privacy mode: the chat works without persistence.
  }
}

export function clearStoredChat(
  suppliedStorage?: Storage,
): void {
  const storage =
    suppliedStorage ??
    (typeof window === "undefined" ? undefined : window.sessionStorage);
  if (!storage) return;
  try {
    storage.removeItem(LEGACY_CHAT_STORAGE_KEY);
    storage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Nothing to protect here.
  }
}

export { CHAT_STORAGE_KEY, MAX_STORED_MESSAGES };
