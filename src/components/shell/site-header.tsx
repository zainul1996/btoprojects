"use client"

import { Show, SignInButton, UserButton } from "@clerk/nextjs"
import { Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/explore", label: "Explore" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/projects", label: "Projects" },
  { href: "/compare", label: "Compare" },
  { href: "/planner", label: "Planner" },
  { href: "/watchlist", label: "Watchlist" },
] as const

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function Wordmark() {
  return (
    <Link
      href="/"
      className="text-lg font-bold tracking-tight text-navy hover:text-navy"
    >
      BTOProjects<span className="text-teal-deep">.sg</span>
    </Link>
  )
}

function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-8">
          <Wordmark />
          <nav aria-label="Primary" className="hidden items-stretch md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 items-center px-3 text-sm font-medium transition-colors",
                    active
                      ? "text-teal-deep after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-teal"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 gap-6">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Wordmark />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(pathname, item.href)
                  return (
                    <SheetClose
                      key={item.href}
                      render={
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                        />
                      }
                      className={cn(
                        "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-teal-subtle text-teal-deeper"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {item.label}
                    </SheetClose>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

export { SiteHeader }
