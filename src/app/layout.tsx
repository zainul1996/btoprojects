import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { CompareTrayProvider } from "@/components/compare-tray";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BTOProjects.sg — Plan your HDB home with confidence",
  description:
    "BTOProjects.sg is a decision platform for Singapore HDB BTO launches — compare projects, analyse locations, and plan your future home with confidence.",
};

export const viewport: Viewport = {
  themeColor: "#f8f6f0", // --paper (warm off-white)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <ConvexClientProvider>
            <TooltipProvider>
              <CompareTrayProvider>
                <SiteHeader />
                <main className="min-h-svh">{children}</main>
                <SiteFooter />
              </CompareTrayProvider>
            </TooltipProvider>
            <Toaster />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
