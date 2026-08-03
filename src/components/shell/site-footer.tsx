import Link from "next/link"

function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 md:px-6">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-12">
          <div className="flex max-w-md flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold tracking-tight text-navy">
                BTOProjects<span className="text-teal-deep">.sg</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Compare BTO projects and SBF town pools with sourced data.
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Independent product, not affiliated with HDB. Project records
              show their source and verification date. Confirm application
              details at the HDB Flat Portal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-12">
            <nav aria-label="Plan and compare" className="flex flex-col gap-1">
              <h2 className="mb-1 text-xs font-semibold tracking-wide text-ink uppercase">
                Plan
              </h2>
              <Link href="/explore" className="inline-flex min-h-11 items-center text-sm hover:text-teal-deep hover:underline sm:min-h-0 sm:py-1">
                Explore projects
              </Link>
              <Link href="/upcoming" className="inline-flex min-h-11 items-center text-sm hover:text-teal-deep hover:underline sm:min-h-0 sm:py-1">
                Launch calendar
              </Link>
              <Link href="/planner" className="inline-flex min-h-11 items-center text-sm hover:text-teal-deep hover:underline sm:min-h-0 sm:py-1">
                AI Planner
              </Link>
              <Link href="/compare" className="inline-flex min-h-11 items-center text-sm hover:text-teal-deep hover:underline sm:min-h-0 sm:py-1">
                Compare
              </Link>
            </nav>

            <nav aria-label="Sources and methodology" className="flex flex-col gap-1">
              <h2 className="mb-1 text-xs font-semibold tracking-wide text-ink uppercase">
                Sources
              </h2>
              <Link href="/methodology" className="inline-flex min-h-11 items-center text-sm hover:text-teal-deep hover:underline sm:min-h-0 sm:py-1">
                Data methodology
              </Link>
              <a
                href="https://homes.hdb.gov.sg"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-sm hover:text-teal-deep hover:underline sm:min-h-0 sm:py-1"
              >
                HDB Flat Portal
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <a
                href="https://data.gov.sg/open-data-licence"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-sm hover:text-teal-deep hover:underline sm:min-h-0 sm:py-1"
              >
                Open data licence
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </nav>
          </div>
        </div>
        <div className="border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">
            © 2026 BTOProjects.sg
          </p>
        </div>
      </div>
    </footer>
  )
}

export { SiteFooter }
