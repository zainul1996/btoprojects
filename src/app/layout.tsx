import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { CompareTrayProvider } from "@/components/compare-tray";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { PlannerChatProvider } from "@/components/planner/planner-chat-provider";
import { AppShell } from "@/components/shell/app-shell";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import {
  absoluteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Singapore BTO and SBF project guide | BTOProjects.sg",
    template: "%s | BTOProjects.sg",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "housing",
  keywords: [
    "Singapore BTO",
    "HDB BTO projects",
    "Sale of Balance Flats",
    "SBF Singapore",
    "HDB launch calendar",
  ],
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Singapore BTO and SBF project guide | BTOProjects.sg",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_SG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Singapore BTO and SBF project guide | BTOProjects.sg",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en-SG",
      publisher: { "@id": `${SITE_URL}/#publisher` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#publisher`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl("/icon.svg"),
      description:
        "Independent Singapore housing decision support. Not affiliated with HDB.",
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#f8f6f0", // --paper (warm off-white)
  // Android Chrome: shrink the layout viewport when the software keyboard
  // opens, so dvh-pinned surfaces (planner composer, filter sheet) sit above
  // it natively. iOS ignores this — the planner tracks visualViewport instead.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <JsonLd id="site-schema" data={siteJsonLd} />
        <ClerkProvider>
          <ConvexClientProvider>
            <TooltipProvider>
              <CompareTrayProvider>
                <PlannerChatProvider>
                  <AppShell header={<SiteHeader />} footer={<SiteFooter />}>
                    {children}
                  </AppShell>
                </PlannerChatProvider>
              </CompareTrayProvider>
            </TooltipProvider>
            <Toaster />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
