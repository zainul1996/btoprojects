"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { Show, SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { ArrowDown, SendHorizonal, Square } from "lucide-react";
import Link from "next/link";
import { useStickToBottom } from "use-stick-to-bottom";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { RankingResultItem } from "../../../convex/lib/plannerShared";
import { useCompare } from "@/components/compare-tray";
import { PageHeader } from "@/components/page-header";
import { PlannerMarkdown } from "@/components/planner/planner-markdown";
import {
  RankingCard,
  type PlannerConstraints,
} from "@/components/planner/ranking-card";
import { useAuthedUser } from "@/components/watchlist/use-authed-user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  PlannerPhase,
  PlannerSuggestion,
  PlannerUIMessage,
} from "@/lib/planner/types";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "We earn S$10k, work in Changi and Buona Vista, parents in Yishun. 4-room under S$550k, can wait 4 years",
  "Shortest wait 3-room in the East",
  "Compare Prime vs Standard for a first-timer",
];

// Per-tab persistence: sessionStorage survives SPA navigation and reloads but
// dies with the tab, which matches the anonymous-session semantics we want.
const CHAT_STORAGE_KEY = "bto.planner.chat.v1";
const MAX_STORED_MESSAGES = 50;
const PERSIST_INTERVAL_MS = 300;

type StoredChat = {
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

function readStoredChat(): StoredChat | null {
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

function writeStoredChat(chat: StoredChat): void {
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

function clearStoredChat(): void {
  try {
    window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Nothing to protect here.
  }
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onStoreChange);
      return () => query.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function textOf(message: PlannerUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function rankingsDataOf(message: PlannerUIMessage) {
  const part = message.parts.find((p) => p.type === "data-rankings");
  return part && part.type === "data-rankings" ? part.data : null;
}

function rankingsOf(message: PlannerUIMessage): RankingResultItem[] | null {
  return rankingsDataOf(message)?.rankings ?? null;
}

function suggestionsOf(message: PlannerUIMessage): PlannerSuggestion[] {
  const part = message.parts.find((p) => p.type === "data-suggestions");
  return part && part.type === "data-suggestions" ? part.data.suggestions : [];
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// Locale-stable ISO formatting: new Date("2026-08-02") shifts a day in
// negative-offset timezones, so render straight from the string parts.
function formatDataAsOf(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  const month = MONTHS_SHORT[monthIndex];
  if (month === undefined) return null;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function citedMapOf(rankings: RankingResultItem[] | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of rankings ?? []) map.set(item.slug, item.name);
  return map;
}

function citedSlugsIn(text: string, rankings: RankingResultItem[] | null) {
  const known = new Set((rankings ?? []).map((r) => r.slug));
  const found = new Set<string>();
  for (const match of text.matchAll(/\[([a-z0-9][a-z0-9-]*)\]/g)) {
    if (known.has(match[1])) found.add(match[1]);
  }
  return [...found];
}

function WorkingDots() {
  return (
    <span className="flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-teal-deep"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

export function PlannerChat() {
  const { slugs: traySlugs } = useCompare();
  const authed = useAuthedUser();
  const saveTurn = useMutation(api.planner.saveTurn);

  const [transport] = useState(
    () => new DefaultChatTransport<PlannerUIMessage>({ api: "/api/planner/chat" }),
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore after mount (never in a useState initializer: this route is
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

  // Streaming updates messages per token, so writes are throttled: at most
  // one write per interval, with a trailing write for the latest state.
  const lastPersistRef = useRef(0);
  useEffect(() => {
    if (!hydrated) return;
    const write = () => {
      lastPersistRef.current = Date.now();
      writeStoredChat({
        messages: messages.slice(-MAX_STORED_MESSAGES),
        constraints,
        sessionId,
        input,
        savedAt: Date.now(),
      });
    };
    const elapsed = Date.now() - lastPersistRef.current;
    if (elapsed >= PERSIST_INTERVAL_MS) {
      write();
      return;
    }
    const timer = setTimeout(write, PERSIST_INTERVAL_MS - elapsed);
    return () => clearTimeout(timer);
  }, [messages, constraints, sessionId, input, hydrated]);

  const reducedMotion = usePrefersReducedMotion();
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } =
    useStickToBottom(
      reducedMotion ? { resize: "instant", initial: "instant" } : {},
    );

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || pending) return;
    setInput("");
    void scrollToBottom(reducedMotion ? "instant" : undefined);
    void sendMessage(
      { text },
      { body: { priorConstraints: constraintsRef.current } },
    );
  };

  // Clearing mid-stream waits for the stream to settle: stop() only aborts
  // the request, and queued stream jobs can still push the partial assistant
  // message after a synchronous setMessages([]).
  const clearOnSettleRef = useRef(false);
  useEffect(() => {
    if (clearOnSettleRef.current && !pending) {
      clearOnSettleRef.current = false;
      setMessages([]);
    }
  }, [pending, setMessages]);

  const newChat = () => {
    clearStoredChat();
    setConstraints(null);
    setSessionId(null);
    setInput("");
    setPhase(null);
    if (pending) {
      clearOnSettleRef.current = true;
      void stop();
    } else {
      setMessages([]);
    }
    textareaRef.current?.focus();
  };

  const fillExample = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const lastMessage = messages[messages.length - 1];
  const lastAssistantHasText =
    lastMessage?.role === "assistant" && textOf(lastMessage).trim().length > 0;
  // The working row covers the pre-stream wait and the streaming phase before
  // the first text token lands; it disappears once text is visible.
  const workingLabel =
    status === "submitted"
      ? (phase?.label ?? "Warming up the model")
      : status === "streaming" && !lastAssistantHasText
        ? (phase?.label ?? "Writing your answer")
        : null;

  return (
    <div
      className={cn(
        "mx-auto flex h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col px-4 md:px-6",
        traySlugs.length > 0 && "pb-20",
      )}
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto overscroll-contain"
        >
          <div ref={contentRef} className="pb-8">
            {!hydrated ? null : messages.length === 0 ? (
              <div>
                <PageHeader
                  title="The planner"
                  lede="Tell me your budget, flat type and how long you can wait. I'll rank every launch against it and show the workings."
                />
                <div className="flex flex-col gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => fillExample(prompt)}
                      className="w-fit max-w-full rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink transition-colors hover:border-teal-deep/40 hover:bg-teal-subtle/40"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <p className="mt-6 text-sm text-muted-foreground">
                  I answer from the project database and cite every fact. If
                  something&apos;s missing or stale, I&apos;ll say so.
                </p>
              </div>
            ) : (
              <div
                role="log"
                aria-live="polite"
                aria-label="Planner conversation"
                className="flex flex-col gap-6 pt-8"
              >
                {messages.map((message, index) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-sm whitespace-pre-line text-primary-foreground">
                        {textOf(message)}
                      </div>
                    </div>
                  ) : (
                    <AssistantTurn
                      key={message.id}
                      message={message}
                      streaming={
                        status === "streaming" && index === messages.length - 1
                      }
                      authed={authed}
                      onReply={send}
                    />
                  ),
                )}

                {workingLabel !== null && (
                  <div
                    role="status"
                    className="flex items-center gap-2.5 text-sm text-muted-foreground"
                  >
                    <WorkingDots />
                    {workingLabel}…
                  </div>
                )}

                {status === "error" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-coral-subtle px-4 py-3">
                    <p className="text-sm text-coral">
                      That didn&apos;t work. Your messages are still here; try
                      again.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void regenerate()}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!isAtBottom && messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void scrollToBottom(reducedMotion ? "instant" : undefined)
            }
            aria-label="Scroll to the latest message"
            className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-surface/95 shadow-md backdrop-blur-sm"
          >
            <ArrowDown aria-hidden />
            Latest
          </Button>
        )}
      </div>

      <div className="-mx-4 border-t border-border bg-paper/95 px-4 pt-3 pb-4 backdrop-blur-sm md:-mx-6 md:px-6">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder="Budget, flat type, towns, how long you can wait…"
            aria-label="Message the planner"
            rows={1}
            className="max-h-40 min-h-11 flex-1 resize-none bg-surface"
          />
          {pending ? (
            <Button
              size="icon-lg"
              variant="outline"
              aria-label="Stop generating"
              onClick={() => void stop()}
            >
              <Square aria-hidden />
            </Button>
          ) : (
            <Button
              size="icon-lg"
              aria-label="Send message"
              disabled={input.trim().length === 0}
              onClick={() => send(input)}
            >
              <SendHorizonal aria-hidden />
            </Button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <Show when="signed-out">
            <p className="flex items-center gap-1">
              <SignInButton mode="modal">
                <Button variant="link" size="sm" className="h-auto px-0 text-xs">
                  Sign in
                </Button>
              </SignInButton>
              to save your planner history
            </p>
          </Show>
          {messages.length > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={newChat}
              className="ml-auto h-auto px-0 text-xs text-muted-foreground hover:text-ink"
            >
              New chat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AssistantTurn({
  message,
  streaming,
  authed,
  onReply,
}: {
  message: PlannerUIMessage;
  streaming: boolean;
  authed: boolean;
  onReply: (text: string) => void;
}) {
  const text = textOf(message);
  const rankingsData = rankingsDataOf(message);
  const rankings = rankingsData?.rankings ?? null;
  const citedMap = citedMapOf(rankings);
  const suggestions = suggestionsOf(message);
  const adjusted = message.parts.some(
    (part) => part.type === "data-replaceText",
  );
  const dataAsOf = rankingsData?.dataAsOf
    ? formatDataAsOf(rankingsData.dataAsOf)
    : null;
  // Cards wait for the narration's first text: an aborted or errored stream
  // must not leave orphaned cards, and text-first avoids a mid-stream layout
  // shift when the cards arrive before the answer.
  const showRankings = rankings !== null && text.trim().length > 0;

  return (
    <div className="space-y-3">
      {text && (
        <div className="text-sm leading-relaxed text-ink">
          <PlannerMarkdown text={text} citedSlugs={citedMap} />
          {streaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-[2px] bg-teal-deep/70 align-text-bottom"
            />
          )}
        </div>
      )}
      {adjusted && text.trim().length > 0 && (
        <p className="text-xs text-muted-foreground italic">
          Adjusted for accuracy.
        </p>
      )}
      {showRankings && (
        <div className="flex flex-col gap-2">
          {rankings.map((ranking) => (
            <RankingCard key={ranking.slug} ranking={ranking} />
          ))}
        </div>
      )}
      {showRankings && rankingsData?.totalProjects !== undefined && (
        <p className="tnum text-xs text-muted-foreground">
          Ranked from {rankingsData.totalProjects} tracked launches
          {dataAsOf ? ` · data as of ${dataAsOf}` : ""}
        </p>
      )}
      {!streaming && suggestions.length > 0 && (
        <div
          role="group"
          aria-label="Suggested follow-ups"
          className="flex flex-wrap gap-2"
        >
          {suggestions.map((suggestion) => (
            <SuggestionChip
              key={suggestion.label}
              suggestion={suggestion}
              authed={authed}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Same quiet outline pill as the example prompts on the empty state.
const SUGGESTION_CHIP_CLASS =
  "max-w-full rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink transition-colors hover:border-teal-deep/40 hover:bg-teal-subtle/40";

function SuggestionChip({
  suggestion,
  authed,
  onReply,
}: {
  suggestion: PlannerSuggestion;
  authed: boolean;
  onReply: (text: string) => void;
}) {
  if (suggestion.kind === "alert") {
    if (!authed) {
      return (
        <SignInButton mode="modal">
          <button type="button" className={SUGGESTION_CHIP_CLASS}>
            {suggestion.label}
          </button>
        </SignInButton>
      );
    }
    return (
      <Link href="/watchlist" className={SUGGESTION_CHIP_CLASS}>
        {suggestion.label}
      </Link>
    );
  }

  const reply = suggestion.message;
  if (!reply) return null;
  return (
    <button
      type="button"
      className={SUGGESTION_CHIP_CLASS}
      onClick={() => onReply(reply)}
    >
      {suggestion.label}
    </button>
  );
}
