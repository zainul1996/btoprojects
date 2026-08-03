"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PlannerConstraints } from "@/components/planner/ranking-card";
import { useAuthedUser } from "@/components/watchlist/use-authed-user";
import {
  clearStoredChat,
  identityTransitionMode,
  readStoredChat,
} from "@/lib/planner/chat-storage";
import { citedSlugsIn, rankingsOf, textOf } from "@/lib/planner/message-parts";
import { constraintsFromProfile } from "@/lib/planner/profile-seed";
import type { PlannerPhase, PlannerUIMessage } from "@/lib/planner/types";

export type PlannerChatContextValue = {
  messages: PlannerUIMessage[];
  status: ReturnType<typeof useChat<PlannerUIMessage>>["status"];
  stop: ReturnType<typeof useChat<PlannerUIMessage>>["stop"];
  pending: boolean;
  lifecycleBlocked: boolean;
  phase: PlannerPhase | null;
  constraints: PlannerConstraints;
  sessionId: Id<"plannerSessions"> | null;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  hydrated: boolean;
  authed: boolean;
  usingSavedPreferences: boolean;
  storageOwner: string | null;
  submitMessage: (text: string, prior: PlannerConstraints) => void;
  retryMessage: () => void;
  resetConversation: () => void;
};

type ActiveRequest = {
  generation: number;
  owner: string | null;
  userMessageId: string;
};

type PendingLifecycle = {
  generation: number;
  mode: "clear" | "rebind";
  owner: string | null;
  preservedMessages?: PlannerUIMessage[];
};

const PlannerChatContext = createContext<PlannerChatContextValue | null>(null);

export function PlannerChatProvider({ children }: { children: ReactNode }) {
  const { isLoaded: clerkLoaded, userId: clerkUserId } = useAuth();
  const currentOwner = clerkUserId ?? null;
  const authed = useAuthedUser();
  const saveTurn = useMutation(api.planner.saveTurn);
  const profile = useQuery(api.profile.getPlannerSeed, authed ? {} : "skip");

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
  const [hydrated, setHydrated] = useState(false);
  const [usingSavedPreferences, setUsingSavedPreferences] = useState(false);
  const [lifecycleBlocked, setLifecycleBlocked] = useState(false);
  const [storageOwner, setStorageOwner] = useState<string | null>(null);

  const restoredOnceRef = useRef(false);
  const clerkIdentityRef = useRef<string | null | undefined>(undefined);
  const generationRef = useRef(0);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const pendingLifecycleRef = useRef<PendingLifecycle | null>(null);
  const authedRef = useRef(authed);
  const ownerRef = useRef<string | null>(currentOwner);
  const constraintsRef = useRef(constraints);
  const sessionIdRef = useRef(sessionId);

  const {
    messages,
    setMessages,
    sendMessage: rawSendMessage,
    status,
    stop,
    regenerate: rawRegenerate,
  } = useChat<PlannerUIMessage>({
    transport,
    onData: (part) => {
      const active = activeRequestRef.current;
      if (part.type === "data-phase") {
        if (!active || part.data.generation !== active.generation) return;
        setPhase({ phase: part.data.phase, label: part.data.label });
      }
      if (part.type === "data-constraints") {
        if (!active || part.data.generation !== active.generation) return;
        constraintsRef.current = part.data.constraints;
        setConstraints(part.data.constraints);
        setUsingSavedPreferences(false);
      }
      if (part.type === "data-replaceText") {
        if (!active || part.data.generation !== active.generation) return;
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
      const active = activeRequestRef.current;
      const userMessage = all[all.length - 2];
      if (
        !active ||
        generationRef.current !== active.generation ||
        ownerRef.current !== active.owner ||
        !userMessage ||
        userMessage.role !== "user" ||
        userMessage.id !== active.userMessageId
      ) {
        return;
      }
      activeRequestRef.current = null;
      setPhase(null);
      if (isError || isAbort || !authedRef.current) return;
      const reply = textOf(message);
      if (!reply) return;
      const rankings = rankingsOf(message);
      const generation = active.generation;
      const owner = active.owner;
      void saveTurn({
        sessionId: sessionIdRef.current ?? undefined,
        userMessage: textOf(userMessage),
        assistantMessage: reply,
        constraints: constraintsRef.current ?? undefined,
        citedProjectSlugs: citedSlugsIn(reply, rankings),
      })
        .then((id) => {
          if (
            generationRef.current === generation &&
            ownerRef.current === owner
          ) {
            setSessionId(id);
          }
        })
        .catch(() => {
          // History is a convenience; never block chat over it.
        });
    },
    onError: () => {
      if (activeRequestRef.current) {
        activeRequestRef.current = null;
        setPhase(null);
      }
    },
  });

  const pending = status === "submitted" || status === "streaming";

  useEffect(() => {
    authedRef.current = authed;
    ownerRef.current = currentOwner;
    constraintsRef.current = constraints;
    sessionIdRef.current = sessionId;
  }, [authed, constraints, currentOwner, sessionId]);

  const finishLifecycle = useCallback(
    (transition: PendingLifecycle) => {
      if (generationRef.current !== transition.generation) return;
      activeRequestRef.current = null;
      authedRef.current = false;
      sessionIdRef.current = null;
      clearStoredChat();
      setSessionId(null);
      setPhase(null);
      setUsingSavedPreferences(false);
      setStorageOwner(transition.owner);
      if (transition.mode === "clear") {
        constraintsRef.current = null;
        setMessages([]);
        setConstraints(null);
        setInput("");
      } else if (transition.preservedMessages) {
        setMessages(transition.preservedMessages);
      }
      setLifecycleBlocked(false);
      setHydrated(true);
    },
    [setMessages],
  );

  const invalidateLifecycle = useCallback((
    mode: "clear" | "rebind",
    owner: string | null,
  ) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const preservedMessages =
      mode === "rebind"
        ? messages.filter(
            (message, index) =>
              !(
                pending &&
                index === messages.length - 1 &&
                message.role === "assistant"
              ),
          )
        : undefined;
    const transition = {
      generation,
      mode,
      owner,
      preservedMessages,
    } satisfies PendingLifecycle;
    activeRequestRef.current = null;
    authedRef.current = false;
    sessionIdRef.current = null;
    clearStoredChat();
    setLifecycleBlocked(true);
    setHydrated(false);
    if (pending) {
      pendingLifecycleRef.current = transition;
      void stop();
      return;
    }
    queueMicrotask(() => finishLifecycle(transition));
  }, [finishLifecycle, messages, pending, stop]);

  useEffect(() => {
    if (pending || pendingLifecycleRef.current === null) return;
    const transition = pendingLifecycleRef.current;
    pendingLifecycleRef.current = null;
    queueMicrotask(() => finishLifecycle(transition));
  });

  useEffect(() => {
    if (!clerkLoaded || restoredOnceRef.current) return;
    restoredOnceRef.current = true;
    const expectedOwner = clerkUserId ?? null;
    clerkIdentityRef.current = expectedOwner;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stored = readStoredChat(expectedOwner);
      setStorageOwner(expectedOwner);
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
  }, [clerkLoaded, clerkUserId, setMessages]);

  useEffect(() => {
    if (!clerkLoaded || clerkIdentityRef.current === undefined) return;
    const previousIdentity = clerkIdentityRef.current;
    const nextIdentity = clerkUserId ?? null;
    if (previousIdentity === nextIdentity) return;
    clerkIdentityRef.current = nextIdentity;
    invalidateLifecycle(
      identityTransitionMode(previousIdentity, nextIdentity),
      nextIdentity,
    );
  }, [clerkLoaded, clerkUserId, invalidateLifecycle]);

  useEffect(() => {
    if (
      !hydrated ||
      lifecycleBlocked ||
      profile === undefined ||
      messages.length > 0 ||
      constraints !== null ||
      !profile
    ) {
      return;
    }
    const seeded = constraintsFromProfile(profile);
    if (!seeded) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || lifecycleBlocked) return;
      setConstraints(seeded);
      setUsingSavedPreferences(true);
    });
    return () => {
      cancelled = true;
    };
  }, [
    constraints,
    hydrated,
    lifecycleBlocked,
    messages.length,
    profile,
  ]);

  const submitMessage = (text: string, prior: PlannerConstraints) => {
    if (pending || lifecycleBlocked || !text.trim()) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const userMessageId = `planner-${generation}-${crypto.randomUUID()}`;
    activeRequestRef.current = {
      generation,
      owner: ownerRef.current,
      userMessageId,
    };
    void rawSendMessage(
      { text: text.trim(), messageId: userMessageId },
      { body: { priorConstraints: prior, requestGeneration: generation } },
    ).catch(() => {
      if (activeRequestRef.current?.generation === generation) {
        activeRequestRef.current = null;
      }
    });
  };

  const retryMessage = () => {
    if (pending || lifecycleBlocked) return;
    const userMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    if (!userMessage) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    activeRequestRef.current = {
      generation,
      owner: ownerRef.current,
      userMessageId: userMessage.id,
    };
    void rawRegenerate({
      body: {
        priorConstraints: constraintsRef.current,
        requestGeneration: generation,
      },
    }).catch(() => {
      if (activeRequestRef.current?.generation === generation) {
        activeRequestRef.current = null;
      }
    });
  };

  return (
    <PlannerChatContext.Provider
      value={{
        messages,
        status,
        stop,
        pending,
        lifecycleBlocked,
        phase,
        constraints,
        sessionId,
        input,
        setInput,
        hydrated,
        authed,
        usingSavedPreferences,
        storageOwner,
        submitMessage,
        retryMessage,
        resetConversation: () =>
          invalidateLifecycle("clear", ownerRef.current),
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
