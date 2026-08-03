import type { Id } from "../../../convex/_generated/dataModel";
import type { PlannerConstraints } from "@/components/planner/ranking-card";
import type { PlannerUIMessage } from "@/lib/planner/types";

// Per-tab persistence: sessionStorage survives SPA navigation and reloads but
// dies with the tab, which matches the anonymous-session semantics we want.
const CHAT_STORAGE_KEY = "bto.planner.chat.v1";
const MAX_STORED_MESSAGES = 50;

export type StoredChat = {
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

export function readStoredChat(): StoredChat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const envelope = parsed as Record<string, unknown>;
    return {
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
    return null;
  }
}

export function writeStoredChat(chat: StoredChat): void {
  try {
    if (
      chat.messages.length === 0 &&
      chat.constraints === null &&
      chat.sessionId === null &&
      chat.input.trim() === ""
    ) {
      window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chat));
  } catch {
    // Quota or privacy mode: the chat works without persistence.
  }
}

export function clearStoredChat(): void {
  try {
    window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Nothing to protect here.
  }
}

export { CHAT_STORAGE_KEY, MAX_STORED_MESSAGES };
