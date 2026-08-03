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

  if (pathname === "/planner") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        {header}
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    );
  }

  return (
    <>
      {header}
      <main className="min-h-svh">{children}</main>
      {footer}
    </>
  );
}
