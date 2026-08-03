import { createSocialImage } from "@/components/seo/social-image";
import { getProjectDetails } from "@/lib/project-data";

export const alt = "BTO or SBF project overview on BTOProjects.sg";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProjectOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const details = await getProjectDetails(slug);

  if (!details) {
    return createSocialImage({
      eyebrow: "Singapore housing project",
      title: "Project details and source history",
      description:
        "Review official facts, estimates and practical planning context.",
    });
  }

  const { project, town, exercise } = details;
  const isSbf = project.saleType === "sbf";
  const townName = town?.name ?? project.region;
  const detail = [
    townName,
    project.classification !== "Unclassified"
      ? project.classification
      : null,
    exercise?.label,
  ]
    .filter(Boolean)
    .join(" · ");

  return createSocialImage({
    eyebrow: isSbf ? "Sale of Balance Flats" : "Build-To-Order project",
    title: project.name,
    description: isSbf
      ? "Town-pool supply, flat types, application data and source history."
      : "Prices, flat mix, waiting time, location context and source history.",
    detail,
  });
}
