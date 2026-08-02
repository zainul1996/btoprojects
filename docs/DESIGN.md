# Design Constitution

The rules every screen, component and interaction in BTOProjects.sg must follow. If a design choice conflicts with this file, this file wins. Update it only with the user's agreement.

Last updated: 2 Aug 2026

## The five questions (ask before shipping ANY screen)

1. **Are we showing too much?** — Progressive disclosure: summary first, detail on demand. Every screen has one clear hierarchy, not a wall of equal-weight facts.
2. **Are we over-explaining?** — If the UI needs a paragraph to explain itself, the UI is wrong. Copy is short, plain, and earns its place.
3. **Is this the most intuitive way?** — Would a first-time user know what to do within 3 seconds, without instructions?
4. **Is fact vs. interpretation obvious?** — A user must never have to guess whether something is `official`, `estimated` or `analysis`. Badges, always.
5. **Does this help a decision?** — Every element exists to move a buyer toward a confident shortlist. Decoration that doesn't serve comprehension goes.

## Product feel

A **calm financial-planning product**, not a property classifieds portal. Spacious, evidence-led, map-forward. Zero aggressive lead forms, popups, urgency tricks or dark patterns — this is a high-stakes housing decision and trust is the product.

## Foundations

| Token | Value direction | Usage |
|---|---|---|
| Navy | deep, desaturated | primary surfaces, headers, text emphasis |
| Teal | mid-tone, confident | interactive accents, links, positive signals, map highlights |
| Warm off-white | slight warmth, never pure gray | page background, cards |
| Coral | restrained | warnings, conflicts, review-queue flags ONLY — never decoration |
| Ink | near-black navy-tinted | body text |

- **Typography:** Inter or Geist. Large numeric hierarchy — prices, counts and stats are display elements, not body text. Tabular numerals for data.
- **Cards:** low-border (or borderless with subtle elevation), generous padding, one idea per card.
- **Badges:** `official` / `estimated` / `analysis` pill system + "last verified" timestamps. This is a trust primitive, not a label — design it once, use it everywhere facts appear.
- **Spacing:** err on more. Dense factual pages must still breathe — section with clear headings and rhythm.

## Components & libraries

- **shadcn/ui + Tailwind CSS** as the component foundation (Radix primitives underneath). Build the design tokens into Tailwind theme from day one — no ad-hoc hex values in components.
- **MapLibre GL JS** for all maps. Custom light basemap; **project polygons are the dominant layer** — everything else recedes.
- Icons: Lucide (ships with shadcn). Consistent stroke, no mixing icon families.
- Charts (price history, comparables): minimal, monochrome-navy with single teal highlight; no rainbow charts.

## Interaction principles

- **One primary action per screen.** Secondary actions are visually quieter.
- **Compare tray is persistent** — adding to compare should feel like collecting, with a sticky tray that never requires hunting.
- **Immediate feedback:** every mutation shows optimistic or loading state; nothing ever feels dead.
- **URL is state:** filters, selected projects and compare sets are shareable via URL.
- **Empty states teach:** no blank boxes — every empty state says what this is and what to do next, in one line.
- **Motion is purposeful:** subtle transitions for state changes only. No gratuitous animation, no parallax.
- **Mobile is designed, not squeezed:** bottom sheet over map for lists/details; full-screen planner; sticky compare tray. Never shrink a desktop sidebar onto a phone.

## AI UX rules

- Desktop: docked right panel. Mobile: full-screen sheet. Chat never covers the map entirely.
- **Citations inside answers**, always — every project fact in an AI response links to its record. No uncited claims, ever.
- Show the interpreted constraints ("You said: 4-room, ≤ S$550k, ≤ 4 years") as chips — the user can correct the machine. **MVP form:** chips are read-only displays; correction happens naturally by replying in chat (the re-extracted constraints replace the chips). Inline chip editing is the V1.x upgrade.
- When data is missing or stale, the AI says so plainly. Confidence is a feature.

## Accessibility floor

- WCAG AA contrast everywhere; coral/teal never carry meaning alone (always paired with text/icon).
- Full keyboard navigation; visible focus states.
- Semantic HTML, proper landmarks — matters for both a11y and SEO.

## Anti-patterns (never ship)

- Information walls: 15 equal-weight stats in a grid
- Nested tabs hiding decision-relevant facts
- "AI says so" without a source link
- Modal-on-modal flows
- Toast-only confirmation of important actions (use inline state)
- Carousel anything
