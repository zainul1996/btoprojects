import { createSocialImage } from "@/components/seo/social-image";

export const alt =
  "BTOProjects.sg, sourced guidance for Singapore BTO and SBF planning";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createSocialImage({
    eyebrow: "Singapore HDB home planning",
    title: "Compare BTO and SBF options with clear sources",
    description:
      "Explore projects, launch timing, prices, locations and trade-offs in one decision workspace.",
    detail: "Independent decision support",
  });
}
