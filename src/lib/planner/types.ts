import type { UIMessage } from "ai";

import type {
  NormalizedConstraints,
  RankingResultItem,
} from "../../../convex/lib/plannerShared";
import type { PlannerTools } from "./tools";

export type PlannerPhaseId =
  | "reading"
  | "searching"
  | "ranking"
  | "resale"
  | "web"
  | "details"
  | "town"
  | "calendar"
  | "writing";

export type PlannerPhase = {
  phase: PlannerPhaseId;
  label: string;
};

export type PlannerSuggestion = {
  /** Chip label shown to the user. */
  label: string;
  /**
   * "reply" sends `message` as the user's next message; "alert" routes to
   * sign-in (anonymous) or the watchlist (signed in) for `town`.
   */
  kind: "reply" | "alert";
  message?: string;
  town?: string;
};

export type PlannerDataParts = {
  /** Transient progress signal while a reply is being prepared. */
  phase: PlannerPhase;
  /** The machine's read of the user's situation (persisted, drives follow-ups). */
  constraints: { constraints: NormalizedConstraints | null };
  /** Deterministic matches for this turn (renders as cards after the text). */
  rankings: {
    rankings: RankingResultItem[];
    /** How many launches the ranker evaluated — trust line denominator. */
    totalProjects?: number;
    /** ISO date the underlying data was retrieved, if known. */
    dataAsOf?: string;
  };
  /** Contextual follow-up chips rendered after an answer completes. */
  suggestions: { suggestions: PlannerSuggestion[] };
  /** Post-stream integrity correction: replace the answer's text. */
  replaceText: { text: string; reason: "citation-check" };
};

export type PlannerUIMessage = UIMessage<unknown, PlannerDataParts, PlannerTools>;
