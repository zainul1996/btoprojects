export type AmenityMapSymbolKind = "mrt" | "hawker" | "park" | "school";

const ICON_PATHS: Record<AmenityMapSymbolKind, string[]> = {
  mrt: [
    "M8 3.1V7a4 4 0 0 0 8 0V3.1",
    "m9 15-1-1",
    "m15 15 1-1",
    "M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z",
    "m8 19-2 3",
    "m16 19 2 3",
  ],
  hawker: [
    "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z",
    "M7 21h10",
    "M19.5 12 22 6",
    "M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62",
    "M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62",
    "M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62",
  ],
  park: [
    "m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z",
    "M12 22v-3",
  ],
  school: [
    "M14 21v-3a2 2 0 0 0-4 0v3",
    "M18 4.933V21",
    "m4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6",
    "m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11",
    "M6 4.933V21",
    "M14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  ],
};

export function AmenityMapSymbol({
  kind,
  className,
  variant,
}: {
  kind: AmenityMapSymbolKind;
  className?: string;
  variant?: "planned";
}) {
  return (
    <span
      className={["bto-amenity-symbol", className].filter(Boolean).join(" ")}
      data-kind={kind}
      data-variant={variant}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICON_PATHS[kind].map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    </span>
  );
}

export function createAmenityMapSymbol(
  kind: AmenityMapSymbolKind,
  className: string,
  variant?: "planned",
): HTMLSpanElement {
  const symbol = document.createElement("span");
  symbol.className = `bto-amenity-symbol ${className}`;
  symbol.dataset.kind = kind;
  if (variant) symbol.dataset.variant = variant;
  symbol.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  for (const pathData of ICON_PATHS[kind]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
  }
  symbol.appendChild(svg);
  return symbol;
}
