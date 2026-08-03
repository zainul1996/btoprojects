import type { Metadata } from "next";

import { PlannerChat } from "@/components/planner/planner-chat";

export const metadata: Metadata = {
  title: "The planner",
  description:
    "Explore BTO and SBF options with cited AI analysis, then rank BTO launches against your budget, flat type, towns and wait tolerance.",
};

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const { prompt } = await searchParams;
  const suggestedPrompt = Array.isArray(prompt) ? prompt[0] : prompt;

  return <PlannerChat suggestedPrompt={suggestedPrompt?.slice(0, 500)} />;
}
