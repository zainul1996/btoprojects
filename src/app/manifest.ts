import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BTOProjects.sg",
    short_name: "BTOProjects",
    description:
      "Compare Singapore HDB BTO projects and SBF town pools with clear sources.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ec",
    theme_color: "#f8f6f0",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
