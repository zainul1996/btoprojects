"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { DefaultChatTransport } from "ai";
import { useChat, type UseChatHelpers } from "@ai-sdk/react";
import { useMutation } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PlannerConstraints } from "@/components/planner/ranking-card";
import { useAuthedUser } from "@/components/watchlist/use-authed-user";
import { readStoredChat } from "@/lib/planner/chat-storage";
import { citedSlugsIn, rankingsOf, textOf } from "@/lib/planner/message-parts";
import type { PlannerPhase, PlannerUIMessage } from "@/lib/planner/types";

export type PlannerChatContextValue = Pick<
  UseChatHelpers<PlannerUIMessage>,
  "messages" | "setMessages" | "sendMessage" | "status" | "stop" | "regenerate"
> & {
  /** True while a reply is being submitted or streamed. */
  pending: boolean;
  phase: PlannerPhase | null;
  setPhase: Dispatch<SetStateAction<PlannerPhase | null>>;
  constraints: PlannerConstraints;
  setConstraints: Dispatch<SetStateAction<PlannerConstraints>>;
  sessionId: Id<"plannerSessions"> | null;
  setSessionId: Dispatch<SetStateAction<Id<"plannerSessions"> | null>>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  /** False through SSR and the first client render, true once the sessionStorage restore has run. */
  hydrated: boolean;
  authed: boolean;
  /** Always-current constraints for stream callbacks and the send body. */
  constraintsRef: RefObject<PlannerConstraints>;
};

const PlannerChatContext = createContext<PlannerChatContextValue | null>(null);

// Lives in the root layout so the chat (and any in-flight stream) survives
// client-side navigation; sessionStorage covers full reloads.
export function PlannerChatProvider({ children }: { children: ReactNode }) {
  const authed = useAuthedUser();
  const saveTurn = useMutation(api.planner.saveTurn);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<PlannerUIMessage>({ api: "/api/planner/chat" }),
  );

  const [phase, setPhase] = useState<PlannerPhase | null>(null);
  const [constraints, setConstraints] = useState<PlannerConstraints>(null);
  const [sessionId, setSessionId] = useState<Id<"plannerSessions"> | null>(
    null,
  );
  const [input, setInput] = useState("");
  // Stays false through SSR and the first client render so the stored chat
  // never fights hydration; the welcome only shows once restore has run.
  const [hydrated, setHydrated] = useState(false);

  // Refs keep streaming callbacks free of stale closures.
  const authedRef = useRef(authed);
  const constraintsRef = useRef(constraints);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    authedRef.current = authed;
    constraintsRef.current = constraints;
    sessionIdRef.current = sessionId;
  }, [authed, constraints, sessionId]);

  const { messages, setMessages, sendMessage, status, stop, regenerate } =
    useChat<PlannerUIMessage>({
      transport,
      onData: (part) => {
        if (part.type === "data-phase") setPhase(part.data);
        if (part.type === "data-constraints") {
          setConstraints(part.data.constraints);
        }
        if (part.type === "data-replaceText") {
          // Post-stream integrity correction: swap the narration, keep the
          // cards and chips. The part itself stays in the message, which is
          // how AssistantTurn knows to show the "Adjusted for accuracy" note.
          const { text } = part.data;
          setMessages((current) => {
            const next = [...current];
            for (let i = next.length - 1; i >= 0; i--) {
              const message = next[i];
              if (message.role !== "assistant") continue;
              next[i] = {
                ...message,
                parts: [
                  { type: "text", text },
                  ...message.parts.filter((p) => p.type !== "text"),
                ],
              };
              break;
            }
            return next;
          });
        }
      },
      onFinish: ({ message, messages: all, isError, isAbort }) => {
        setPhase(null);
        if (isError || isAbort || !authedRef.current) return;
        const userMessage = all[all.length - 2];
        if (!userMessage || userMessage.role !== "user") return;
        const reply = textOf(message);
        if (!reply) return;
        const rankings = rankingsOf(message);
        void saveTurn({
          sessionId: sessionIdRef.current ?? undefined,
          userMessage: textOf(userMessage),
          assistantMessage: reply,
          constraints: constraintsRef.current ?? undefined,
          citedProjectSlugs: citedSlugsIn(reply, rankings),
        })
          .then((id) => setSessionId(id))
          .catch(() => {
            // History is a convenience; never block the chat over it.
          });
      },
      onError: () => setPhase(null),
    });

  const pending = status === "submitted" || status === "streaming";

  // Restore after mount (never in a useState initializer: the shell is
  // prerendered, and sessionStorage does not exist on the server). The
  // microtask keeps state writes out of the synchronous effect body; the
  // cancelled flag covers unmount and StrictMode's double effect.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stored = readStoredChat();
      if (stored) {
        if (stored.messages.length > 0) setMessages(stored.messages);
        if (stored.constraints) setConstraints(stored.constraints);
        if (stored.sessionId) setSessionId(stored.sessionId);
        if (stored.input) setInput(stored.input);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [setMessages]);

  return (
    <PlannerChatContext.Provider
      value={{
        messages,
        setMessages,
        sendMessage,
        status,
        stop,
        regenerate,
        pending,
        phase,
        setPhase,
        constraints,
        setConstraints,
        sessionId,
        setSessionId,
        input,
        setInput,
        hydrated,
        authed,
        constraintsRef,
      }}
    >
      {children}
    </PlannerChatContext.Provider>
  );
}

export function usePlannerChat(): PlannerChatContextValue {
  const context = useContext(PlannerChatContext);
  if (context === null) {
    throw new Error("usePlannerChat must be used within PlannerChatProvider");
  }
  return context;
}
