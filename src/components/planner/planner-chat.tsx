"use client";

import { useEffect, useRef, useState } from "react";
import { Show, SignInButton } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { SendHorizonal } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCompare } from "@/components/compare-tray";
import { PageHeader } from "@/components/page-header";
import { CitedText } from "@/components/planner/cited-text";
import { ConstraintsBar } from "@/components/planner/constraints-bar";
import {
  RankingCard,
  type PlannerConstraints,
  type PlannerRanking,
} from "@/components/planner/ranking-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  rankings?: PlannerRanking[];
  citedProjectSlugs?: string[];
};

const EXAMPLE_PROMPTS = [
  "We earn S$10k, work in Changi and Buona Vista, parents in Yishun — 4-room under S$550k, can wait 4 years",
  "Shortest wait 3-room in the East",
  "Compare Prime vs Standard for a first-timer",
];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function PlannerChat() {
  const sendMessage = useAction(api.plannerActions.sendMessage);
  const { slugs: traySlugs } = useCompare();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [constraints, setConstraints] = useState<PlannerConstraints>(null);
  const [sessionId, setSessionId] = useState<Id<"plannerSessions"> | null>(
    null,
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || pending) return;

    setFailedMessage(null);
    setInput("");
    setPending(true);
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "user", content: message },
    ]);

    // Backend builds its LLM transcript from `history` for both authed and
    // anonymous users; authed persistence threads through `sessionId`.
    const history = messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await sendMessage({
        message,
        history,
        ...(sessionId ? { sessionId } : {}),
      });
      if (result.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: result.reply,
            rankings: result.rankings.length ? result.rankings : undefined,
            citedProjectSlugs: result.citedProjectSlugs,
          },
        ]);
        if (result.constraints) setConstraints(result.constraints);
        if (result.sessionId) setSessionId(result.sessionId);
      } else {
        // The backend declined gracefully (e.g. not configured) — its reply
        // is still the honest thing to show.
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", content: result.reply },
        ]);
      }
    } catch {
      setFailedMessage(message);
    } finally {
      setPending(false);
    }
  };

  const fillExample = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col px-4 md:px-6">
      <div className="flex-1 pb-8">
        {messages.length === 0 ? (
          <div>
            <PageHeader
              title="The planner"
              lede="Describe your situation — I'll turn it into a ranked shortlist with evidence."
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
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-sm whitespace-pre-line text-primary-foreground">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="space-y-3">
                  <div className="text-sm leading-relaxed whitespace-pre-line text-ink">
                    <CitedText
                      text={message.content}
                      citedSlugs={message.citedProjectSlugs ?? []}
                    />
                  </div>
                  {message.rankings && (
                    <div className="flex flex-col gap-2">
                      {message.rankings.map((ranking) => (
                        <RankingCard key={ranking.slug} ranking={ranking} />
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}

            {pending && (
              <div
                role="status"
                className="flex items-center gap-2.5 text-sm text-muted-foreground"
              >
                <span className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-pulse rounded-full bg-teal-deep"
                      style={{ animationDelay: `${i * 180}ms` }}
                    />
                  ))}
                </span>
                Ranking projects against your constraints…
              </div>
            )}

            {failedMessage !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-coral-subtle px-4 py-3">
                <p className="text-sm text-coral">
                  Something went wrong ranking projects — please try again.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void send(failedMessage)}
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
                void send(input);
              }
            }}
            placeholder="Budget, flat type, towns, how long you can wait…"
            aria-label="Message the planner"
            rows={1}
            className="max-h-40 min-h-11 flex-1 resize-none bg-surface"
          />
          <Button
            size="icon-lg"
            aria-label="Send message"
            disabled={pending || input.trim().length === 0}
            onClick={() => void send(input)}
          >
            <SendHorizonal aria-hidden />
          </Button>
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
