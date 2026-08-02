import type { Metadata } from "next";

import { PlannerChat } from "@/components/planner/planner-chat";

export const metadata: Metadata = {
  title: "The planner",
  description:
    "Describe your budget, flat type, towns and wait tolerance. Get a ranked BTO shortlist with evidence and citations.",
};

export default function PlannerPage() {
  return <PlannerChat />;
}
