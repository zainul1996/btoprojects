"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  COMPARE_MAX,
  COMPARE_STORAGE_KEY,
  compareUrl,
  prettifySlug,
} from "@/lib/compare";
import { cn } from "@/lib/utils";

type CompareContextValue = {
  slugs: string[];
  add: (slug: string) => boolean;
  remove: (slug: string) => void;
  clear: () => void;
  has: (slug: string) => boolean;
  isFull: boolean;
};

const CompareContext = createContext<CompareContextValue | null>(null);

/**
 * Anonymous-friendly compare tray (guardrail: no auth wall). State lives in
 * localStorage — syncing to accounts is a V1 concern.
 */
export function CompareTrayProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setSlugs(parsed.filter((s): s is string => typeof s === "string").slice(0, COMPARE_MAX));
        }
      }
    } catch {
      // Corrupt storage — start fresh.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(slugs));
  }, [slugs, hydrated]);

  const add = useCallback(
    (slug: string) => {
      let ok = false;
      setSlugs((current) => {
        if (current.includes(slug)) {
          ok = true;
          return current;
        }
        if (current.length >= COMPARE_MAX) {
          return current;
        }
        ok = true;
        return [...current, slug];
      });
      return ok;
    },
    [],
  );

  const remove = useCallback((slug: string) => {
    setSlugs((current) => current.filter((s) => s !== slug));
  }, []);

  const clear = useCallback(() => setSlugs([]), []);

  const value = useMemo<CompareContextValue>(
    () => ({
      slugs,
      add,
      remove,
      clear,
      has: (slug) => slugs.includes(slug),
      isFull: slugs.length >= COMPARE_MAX,
    }),
    [slugs, add, remove, clear],
  );

  return (
    <CompareContext.Provider value={value}>
      {children}
      <CompareTray />
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareTrayProvider");
  return ctx;
}

function CompareTray() {
  const { slugs, remove, clear } = useCompare();

  // Never render during SSR/first paint — localStorage is client-only.
  if (slugs.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-border bg-surface py-2 pr-2 pl-4 shadow-lg shadow-navy/10">
        <ArrowLeftRight className="size-4 shrink-0 text-teal-deep" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {slugs.map((slug) => (
            <span
              key={slug}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-ink"
            >
              {prettifySlug(slug)}
              <button
                type="button"
                onClick={() => remove(slug)}
                aria-label={`Remove ${prettifySlug(slug)} from comparison`}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-border hover:text-ink"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={clear}
          className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-ink"
        >
          Clear
        </button>
        <Button
          size="sm"
          render={<Link href={compareUrl(slugs)} />}
          nativeButton={false}
          className={cn("shrink-0 rounded-full")}
          disabled={slugs.length < 2}
          onClick={() => {
            if (slugs.length < 2) toast("Add at least 2 projects to compare");
          }}
        >
          Compare ({slugs.length})
        </Button>
      </div>
    </div>
  );
}
