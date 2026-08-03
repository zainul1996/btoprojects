import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { getProjectDetails } from "@/lib/project-data";
import { absoluteUrl, breadcrumbJsonLd, SITE_URL } from "@/lib/seo";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const details = await getProjectDetails(slug);

  if (!details) return children;

  const { project, town, exercise } = details;
  const townName = town?.name ?? project.region;
  const path = `/projects/${project.slug}`;
  const breadcrumbItems = [
    { name: "Home", path: "/" },
    { name: "Explore projects", path: "/explore" },
    ...(exercise
      ? [
          {
            name: exercise.label,
            path:
              exercise.type === "sbf"
                ? `/sbf/${exercise.key}`
                : `/bto/${exercise.key}`,
          },
        ]
      : []),
    { name: project.name, path },
  ];
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemPage",
    "@id": `${absoluteUrl(path)}#page`,
    url: absoluteUrl(path),
    name: project.name,
    description: project.description,
    dateModified: new Date(project.updatedAt).toISOString(),
    inLanguage: "en-SG",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about:
      project.saleType === "sbf"
        ? {
            "@type": "Thing",
            name: `${townName} Sale of Balance Flats town pool`,
            description:
              "Balance flats offered by town and flat type within an HDB sales exercise.",
          }
        : {
            "@type": "ApartmentComplex",
            name: project.name,
            description: project.description,
            url: absoluteUrl(path),
            address: {
              "@type": "PostalAddress",
              addressLocality: townName,
              addressRegion: project.region,
              addressCountry: "SG",
            },
          },
  };

  return (
    <>
      <JsonLd id="project-page-schema" data={pageJsonLd} />
      <JsonLd
        id="project-breadcrumb-schema"
        data={breadcrumbJsonLd(breadcrumbItems)}
      />
      {children}
    </>
  );
}
