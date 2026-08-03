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
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BTOProjects.sg — Plan your HDB home with confidence",
  description:
    "BTOProjects.sg is a decision platform for Singapore HDB BTO launches. Compare projects, analyse locations and plan your home with confidence.",
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
