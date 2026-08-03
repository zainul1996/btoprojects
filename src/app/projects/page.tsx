import { permanentRedirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const incoming = await searchParams;
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(incoming)) {
    if (key === "view" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      next.append(key, item);
    }
  }
  next.set("view", "exercise");

  permanentRedirect(`/explore?${next.toString()}`);
}
