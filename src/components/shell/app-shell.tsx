"use client";

import { usePathname } from "next/navigation";

/**
 * Route-aware chrome. The planner is a whole-page chat: viewport-locked, no
 * footer, and the chat's own scroll region is the only scroller. Every other
 * route keeps the normal document flow with the site footer. usePathname is
 * available during SSR, so the planner branch renders correctly on first
 * paint with no footer flash.
 */
export function AppShell({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const skipLink = (
    <a
      href="#main-content"
      className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg focus:not-sr-only"
    >
      Skip to main content
    </a>
  );

  if (pathname === "/planner") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        {skipLink}
        {header}
        <main id="main-content" className="min-h-0 flex-1">{children}</main>
      </div>
    );
  }

  return (
    <>
      {skipLink}
      {header}
      <main id="main-content" className="min-h-0 flex-1">{children}</main>
      {footer}
    </>
  );
}
