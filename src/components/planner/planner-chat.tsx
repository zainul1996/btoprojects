"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Show, SignInButton } from "@clerk/nextjs";
import { ArrowDown, ArrowRight, SendHorizonal, Square } from "lucide-react";
import Link from "next/link";
import { useStickToBottom } from "use-stick-to-bottom";

import { useCompare } from "@/components/compare-tray";
import { PageHeader } from "@/components/page-header";
import { usePlannerChat } from "@/components/planner/planner-chat-provider";
import { PlannerMarkdown } from "@/components/planner/planner-markdown";
import {
  RankingCard,
  type PlannerConstraints,
} from "@/components/planner/ranking-card";
import { SourceBadge } from "@/components/source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { WatchButton } from "@/components/watch-button";
import {
  MAX_STORED_MESSAGES,
  writeStoredChat,
} from "@/lib/planner/chat-storage";
import {
  citedMapOf,
  formatDataAsOf,
  rankingsDataOf,
  suggestionsOf,
  textOf,
} from "@/lib/planner/message-parts";
import type { PlannerSuggestion, PlannerUIMessage } from "@/lib/planner/types";
import { useVisualViewportHeight } from "@/lib/use-visual-viewport";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  {
    prompt: "Which 4-room BTO projects start below S$550k?",
  },
  {
    prompt: "Which BTO projects have the shortest waiting time?",
  },
  {
    prompt: "Should I apply for BTO or SBF?",
  },
];

// The full hint wraps to two lines under the sm breakpoint, inflating the
// empty composer (field-sizing: content) — mobile gets the short form.
const PLACEHOLDER_FULL = "Ask about BTO, SBF, prices, waits or flat rules…";
const PLACEHOLDER_SHORT = "Ask about BTO or SBF…";

// Per-tab persistence helpers live in @/lib/planner/chat-storage (shared with
// the provider, which owns the restore read).
const PERSIST_INTERVAL_MS = 300;

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    // Mobile-first server snapshot: the narrow-screen variant never causes a
    // post-hydration layout shift on desktop, the wide one would on mobile.
    () => false,
  );
}

function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
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

function PlannerSignInHint({ className }: { className?: string }) {
  return (
    <Show when="signed-out">
      <p
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground",
          className,
        )}
      >
        <SignInButton mode="modal">
          <Button
            variant="link"
            size="sm"
            className="h-auto min-h-11 px-0 py-2 text-xs sm:min-h-0 sm:py-0"
          >
            Sign in
          </Button>
        </SignInButton>
        to save your planner history
      </p>
    </Show>
  );
}

function PlannerNewChatButton({
  className,
  onClick,
}: {
  className?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="link"
      size="sm"
      onClick={onClick}
      className={cn(
        "ml-auto h-auto min-h-11 px-0 py-2 text-xs text-muted-foreground hover:text-ink sm:min-h-0 sm:py-0",
        className,
      )}
    >
      New chat
    </Button>
  );
}

function constraintLabels(constraints: NonNullable<PlannerConstraints>): string[] {
  const labels: string[] = [];
  if (constraints.budgetMax) {
    labels.push(`Budget ≤ S$${constraints.budgetMax.toLocaleString("en-SG")}`);
  }
  if (constraints.flatTypes?.length) labels.push(constraints.flatTypes.join(", "));
  if (constraints.waitToleranceMonths) {
    labels.push(`Wait ≤ ${constraints.waitToleranceMonths} months`);
  }
  if (constraints.towns?.length) labels.push(constraints.towns.join(", "));
  if (constraints.regions?.length) {
    labels.push(`${constraints.regions.join(", ")} region`);
  }
  if (constraints.workplaces?.length) {
    labels.push(`Work: ${constraints.workplaces.join(", ")}`);
  }
  if (constraints.parentsArea) {
    labels.push(`Parents: ${constraints.parentsArea}`);
  }
  return labels;
}

function InterpretedConstraints({
  constraints,
  usingSavedPreferences,
}: {
  constraints: NonNullable<PlannerConstraints>;
  usingSavedPreferences: boolean;
}) {
  const labels = constraintLabels(constraints);
  if (labels.length === 0) return null;

  return (
    <aside aria-label="Interpreted planning constraints" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          You said
        </h2>
        <SourceBadge variant="analysis" size="sm" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <Badge key={label} variant="secondary" className="font-normal">
            {label}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {usingSavedPreferences ? (
          <>
            Using saved preferences ·{" "}
            <Link
              href="/watchlist?tab=preferences"
              className="text-teal-deep hover:underline"
            >
              Edit
            </Link>
          </>
        ) : (
          "Reply with a correction to update these constraints."
        )}
      </p>
    </aside>
  );
}

export function PlannerChat({
  suggestedPrompt,
}: {
  suggestedPrompt?: string;
}) {
  const { slugs: traySlugs } = useCompare();
  const {
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
    usingSavedPreferences,
    storageOwner,
    submitMessage,
    retryMessage,
    resetConversation,
  } = usePlannerChat();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appliedPromptRef = useRef<string | undefined>(undefined);

  // Context links suggest a starting point without submitting it. A clean
  // composer can be prefilled; restored drafts and conversations are kept.
  useEffect(() => {
    if (
      !hydrated ||
      !suggestedPrompt ||
      appliedPromptRef.current === suggestedPrompt
    ) {
      return;
    }
    appliedPromptRef.current = suggestedPrompt;
    if (messages.length === 0 && input.trim().length === 0) {
      setInput(suggestedPrompt);
    }
  }, [hydrated, input, messages.length, setInput, suggestedPrompt]);

  // Streaming updates messages per token, so writes are throttled: at most
  // one write per interval, with a trailing write for the latest state. The
  // restore read lives in the provider (it owns the chat state); this write
  // side stays here so persistence tracks the visible conversation.
  const lastPersistRef = useRef(0);
  useEffect(() => {
    if (!hydrated) return;
    const write = () => {
      lastPersistRef.current = Date.now();
      writeStoredChat({
        owner: storageOwner,
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
  }, [
    messages,
    constraints,
    sessionId,
    input,
    hydrated,
    storageOwner,
  ]);

  const reducedMotion = usePrefersReducedMotion();
  const wideComposer = useMediaQuery("(min-width: 640px)");
  // px height while the software keyboard is open (iOS); null otherwise, so
  // the CSS dvh height below carries desktop, Android and keyboard-closed.
  const keyboardHeight = useVisualViewportHeight();
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } =
    useStickToBottom(
      reducedMotion ? { resize: "instant", initial: "instant" } : {},
    );

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || pending || lifecycleBlocked) return;
    setInput("");
    void scrollToBottom(reducedMotion ? "instant" : undefined);
    submitMessage(text, constraints);
  };

  const newChat = () => {
    resetConversation();
    textareaRef.current?.focus();
  };

  const fillExample = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const useSuggestedPrompt = () => {
    if (!suggestedPrompt) return;
    setInput((current) => {
      if (current.includes(suggestedPrompt)) return current;
      return current.trim().length > 0
        ? `${current.trimEnd()}\n\n${suggestedPrompt}`
        : suggestedPrompt;
    });
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
      style={
        keyboardHeight === null ? undefined : { height: keyboardHeight }
      }
      className={cn(
        // Fills <main> exactly (the app shell viewport-locks the planner
        // route); the chat scroll region below is the page's only scroller.
        "flex h-full w-full flex-col",
        // Clearing the compare tray is pointless while the keyboard covers it.
        traySlugs.length > 0 && keyboardHeight === null && "pb-20",
      )}
    >
      <div className="relative min-h-0 flex-1">
        {/* Full-bleed scroll region: wheeling over the side gutters scrolls
            the conversation too; the content column stays centered inside. */}
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto overscroll-contain"
        >
          <div
            ref={contentRef}
            className="mx-auto w-full max-w-3xl px-4 pb-8 md:px-6"
          >
            {hydrated && suggestedPrompt ? (
              <Card size="sm" className="mt-4 mb-4 bg-teal-subtle/30">
                <CardContent>
                  <p className="text-xs font-medium text-teal-deeper">
                    Question ready to edit
                  </p>
                  <p className="mt-1 text-sm text-ink">{suggestedPrompt}</p>
                  {input.includes(suggestedPrompt) ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      It is in the message box. Nothing has been sent.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={useSuggestedPrompt}
                      >
                        {input.trim().length > 0
                          ? "Add prompt to draft"
                          : "Use this prompt"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Nothing will be sent automatically.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
            {!hydrated ? (
              <div aria-busy="true" aria-label="Loading planner">
                <PageHeader
                  title="AI Planner"
                  lede="Ask about BTO and SBF projects, prices, waiting times or flat rules. Share your budget and needs when you want help choosing."
                />
                <div className="flex flex-col gap-2" aria-hidden>
                  <Skeleton className="h-12 w-full max-w-2xl rounded-2xl" />
                  <Skeleton className="h-10 w-64 rounded-2xl" />
                  <Skeleton className="h-10 w-72 rounded-2xl" />
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div>
                <PageHeader
                  title="AI Planner"
                  lede="Ask about BTO and SBF projects, prices, waiting times or flat rules. Share your budget and needs when you want help choosing."
                />
                {usingSavedPreferences ? (
                  <div
                    role="note"
                    className="mb-5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-ink"
                  >
                    Saved budget and location aliases will shape ranking. Exact
                    addresses stay private and are not sent to the AI provider.{" "}
                    <Link
                      href="/watchlist?tab=preferences"
                      className="text-teal-deep hover:underline"
                    >
                      Edit preferences
                    </Link>
                  </div>
                ) : null}
                <h2 className="mb-2 text-sm font-semibold text-ink">
                  Try asking
                </h2>
                <div className="flex flex-col gap-2.5">
                  {EXAMPLE_PROMPTS.map((example) => (
                    <Button
                      key={example.prompt}
                      type="button"
                      variant="outline"
                      onClick={() => fillExample(example.prompt)}
                      className="h-auto min-h-12 w-full justify-between gap-3 px-3.5 py-3 text-left whitespace-normal"
                    >
                      <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                        {example.prompt}
                      </span>
                      <ArrowRight data-icon="inline-end" aria-hidden />
                    </Button>
                  ))}
                </div>
                <p className="mt-6 text-sm text-muted-foreground">
                  Answers use the project database and cite project facts. You
                  can search BTO and SBF options; recommendations currently
                  cover BTO launches.
                </p>
                <nav
                  aria-label="Other project tools"
                  className="mt-3 flex flex-wrap gap-x-3 text-sm"
                >
                  <Link href="/explore" className="text-teal-deep hover:underline">
                    Find projects
                  </Link>
                  <Link href="/compare" className="text-teal-deep hover:underline">
                    Compare projects
                  </Link>
                </nav>
              </div>
            ) : (
              <div
                role="log"
                aria-live="polite"
                aria-label="Planner conversation"
                className="flex flex-col gap-6 pt-8"
              >
                {constraints ? (
                  <InterpretedConstraints
                    constraints={constraints}
                    usingSavedPreferences={usingSavedPreferences}
                  />
                ) : null}
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
                      onClick={retryMessage}
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

      <div
        className={cn(
          "border-t border-border bg-paper/95 pt-3 backdrop-blur-sm",
          // Keyboard open: the home-indicator inset is under the keyboard, so
          // a tight padding lets the field sit lower, just off the keys.
          keyboardHeight === null
            ? "pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "pb-2",
        )}
      >
        <div className="mx-auto w-full max-w-3xl px-4 md:px-6">
          <div className="mb-1 flex items-center gap-3 empty:hidden sm:hidden">
            <PlannerSignInHint className="min-w-0 flex-1" />
            {messages.length > 0 && (
              <PlannerNewChatButton onClick={newChat} />
            )}
          </div>
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
              placeholder={wideComposer ? PLACEHOLDER_FULL : PLACEHOLDER_SHORT}
              aria-label="Message the AI Planner"
              enterKeyHint="send"
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
                disabled={
                  input.trim().length === 0 || lifecycleBlocked
                }
                onClick={() => send(input)}
              >
                <SendHorizonal aria-hidden />
              </Button>
            )}
          </div>
          <div className="mt-2 hidden flex-wrap items-center gap-x-3 text-xs text-muted-foreground sm:flex">
            <PlannerSignInHint />
            {messages.length > 0 && (
              <PlannerNewChatButton onClick={newChat} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantTurn({
  message,
  streaming,
  onReply,
}: {
  message: PlannerUIMessage;
  streaming: boolean;
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
          AI analysis · Ranked from {rankingsData.totalProjects} tracked BTO
          launches
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
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Same quiet outline chip as the example prompts on the empty state.
// rounded-2xl (not full): prompts wrap to several lines on phones, and a
// stadium radius on a tall block reads as a sausage, not a chip.
const SUGGESTION_CHIP_CLASS =
  "min-h-11 max-w-full rounded-2xl border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink transition-colors hover:border-teal-deep/40 hover:bg-teal-subtle/40";

function SuggestionChip({
  suggestion,
  onReply,
}: {
  suggestion: PlannerSuggestion;
  onReply: (text: string) => void;
}) {
  if (suggestion.kind === "alert") {
    if (!suggestion.town) return null;
    return (
      <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-3.5 py-2">
        <span className="text-sm text-ink">{suggestion.label}</span>
        <WatchButton
          targetType="town"
          targetId={suggestion.town}
          label={suggestion.town}
        />
      </div>
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
