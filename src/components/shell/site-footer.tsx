import Link from "next/link"

function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-10 md:px-6">
        <div className="space-y-1">
          <p className="text-sm font-bold tracking-tight text-navy">
            BTOProjects<span className="text-teal-deep">.sg</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Plan your HDB home with confidence.
          </p>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p>
            Independent product, not affiliated with HDB. Verify official
            details at{" "}
            <a
              href="https://www.hdb.gov.sg"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-teal-deep hover:underline"
            >
              hdb.gov.sg
            </a>
            .
          </p>
          <p>
            Source data: Housing &amp; Development Board and data.gov.sg.
            Individual records cite their source and verification date.
          </p>
          <p>
            Resale data is made available under the{" "}
            <a
              href="https://data.gov.sg/open-data-licence"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-teal-deep hover:underline"
            >
              Singapore Open Data Licence version 1.0
            </a>
            .
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
        >
          <Link href="/explore" className="hover:text-teal-deep hover:underline">
            Explore projects
          </Link>
          <Link href="/upcoming" className="hover:text-teal-deep hover:underline">
            Launch calendar
          </Link>
          <Link href="/compare" className="hover:text-teal-deep hover:underline">
            Compare
          </Link>
          <Link href="/methodology" className="hover:text-teal-deep hover:underline">
            Data methodology
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © 2026 BTOProjects.sg
        </p>
      </div>
    </footer>
  )
}

export { SiteFooter }
