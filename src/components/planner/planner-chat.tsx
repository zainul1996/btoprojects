"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { Show, SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { SendHorizonal, Square } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { RankingResultItem } from "../../../convex/lib/plannerShared";
import { useCompare } from "@/components/compare-tray";
import { PageHeader } from "@/components/page-header";
import { ConstraintsBar } from "@/components/planner/constraints-bar";
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
  PlannerUIMessage,
} from "@/lib/planner/types";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "We earn S$10k, work in Changi and Buona Vista, parents in Yishun. 4-room under S$550k, can wait 4 years",
  "Shortest wait 3-room in the East",
  "Compare Prime vs Standard for a first-timer",
];

function textOf(message: PlannerUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function rankingsOf(message: PlannerUIMessage): RankingResultItem[] | null {
  const part = message.parts.find((p) => p.type === "data-rankings");
  return part && part.type === "data-rankings" ? part.data.rankings : null;
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

  // Refs keep streaming callbacks free of stale closures.
  const authedRef = useRef(authed);
  const constraintsRef = useRef(constraints);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    authedRef.current = authed;
    constraintsRef.current = constraints;
    sessionIdRef.current = sessionId;
  }, [authed, constraints, sessionId]);

  const { messages, sendMessage, status, stop, regenerate } =
    useChat<PlannerUIMessage>({
      transport,
      onData: (part) => {
        if (part.type === "data-phase") setPhase(part.data);
        if (part.type === "data-constraints") {
          setConstraints(part.data.constraints);
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages[messages.length - 1];
  const lastTextLength = lastMessage ? textOf(lastMessage).length : 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastTextLength, pending]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || pending) return;
    setInput("");
    void sendMessage({ text });
  };

  const fillExample = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const phaseLabel = useMemo(() => {
    if (status !== "submitted") return null;
    return phase?.label ?? "Warming up the model";
  }, [status, phase]);

  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col px-4 md:px-6">
      <div className="flex-1 pb-8">
        {messages.length === 0 ? (
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
                />
              ),
            )}

            {status === "submitted" && (
              <div
                role="status"
                className="flex items-center gap-2.5 text-sm text-muted-foreground"
              >
                <WorkingDots />
                {phaseLabel}…
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
        <div ref={bottomRef} />
      </div>

      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-4 border-t border-border bg-paper/95 px-4 pt-3 pb-4 backdrop-blur-sm md:-mx-6 md:px-6",
          traySlugs.length > 0 && "bottom-20",
        )}
      >
        <ConstraintsBar constraints={constraints} />
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
        <Show when="signed-out">
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <SignInButton mode="modal">
              <Button variant="link" size="sm" className="h-auto px-0 text-xs">
                Sign in
              </Button>
            </SignInButton>
            to save your planner history
          </p>
        </Show>
      </div>
    </div>
  );
}

function AssistantTurn({
  message,
  streaming,
}: {
  message: PlannerUIMessage;
  streaming: boolean;
}) {
  const text = textOf(message);
  const rankings = rankingsOf(message);
  const citedMap = citedMapOf(rankings);

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
      {rankings && (
        <div className="flex flex-col gap-2">
          {rankings.map((ranking) => (
            <RankingCard key={ranking.slug} ranking={ranking} />
          ))}
        </div>
      )}
    </div>
  );
}
