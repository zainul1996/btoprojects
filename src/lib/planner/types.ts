import type { UIMessage } from "ai";

import type {
  NormalizedConstraints,
  RankingResultItem,
} from "../../../convex/lib/plannerShared";

export type PlannerPhaseId = "reading" | "searching" | "ranking" | "writing";

export type PlannerPhase = {
  phase: PlannerPhaseId;
  label: string;
};

export type PlannerDataParts = {
  /** Transient progress signal while a reply is being prepared. */
  phase: PlannerPhase;
  /** The machine's read of the user's situation (renders as chips). */
  constraints: { constraints: NormalizedConstraints | null };
  /** Deterministic top matches for this turn (renders as cards). */
  rankings: { rankings: RankingResultItem[] };
};

export type PlannerUIMessage = UIMessage<unknown, PlannerDataParts>;
