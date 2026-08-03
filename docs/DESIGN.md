# Design Constitution

The rules every screen, component and interaction in BTOProjects.sg must follow. If a design choice conflicts with this file, this file wins. Update it only with the user's agreement.

Last updated: 3 Aug 2026

## The five questions (ask before shipping ANY screen)

1. **Are we showing too much?** Use progressive disclosure: summary first, detail on demand. Every screen has one clear hierarchy, not a wall of equal-weight facts.
2. **Are we over-explaining?** If the UI needs a paragraph to explain itself, the UI is wrong. Copy is short, plain, and earns its place.
3. **Is this the most intuitive way?** A first-time user should know what to do within 3 seconds, without instructions.
4. **Is fact vs. interpretation obvious?** A user must never have to guess whether something is `official`, `estimated` or `analysis`. Badges are mandatory.
5. **Does this help a decision?** Every element exists to move a buyer toward a confident shortlist. Decoration that does not serve comprehension goes.

## Product feel

A **calm financial-planning product**, not a property classifieds portal. Spacious, evidence-led and map-forward. Do not use aggressive lead forms, popups, urgency tricks or dark patterns. This is a high-stakes housing decision, so trust is the product.

## Foundations

| Token | Value direction | Usage |
|---|---|---|
| Navy | deep, desaturated | primary surfaces, headers, text emphasis |
| Teal | mid-tone, confident | interactive accents, links, positive signals, map highlights |
| Warm off-white | slight warmth, never pure gray | page background, cards |
| Coral | restrained | warnings, conflicts and review-queue flags only; never decoration |
| Ink | near-black navy-tinted | body text |

- **Typography:** Inter or Geist. Prices, counts and stats are display elements, not body text. Use tabular numerals for data.
- **Cards:** low-border (or borderless with subtle elevation), generous padding, one idea per card.
- **Badges:** `official` / `estimated` / `analysis` pill system plus "last verified" timestamps. This is a trust primitive, not a decorative label. Design it once and use it everywhere facts appear.
- **Spacing:** err on more. Dense factual pages must still breathe, with clear section headings and rhythm.

## Choosing a content container

Use the lightest structure that makes the relationship clear. A card is not the default container for every idea.

| Pattern | Use it for | Do not use it for |
|---|---|---|
| Card | One cohesive decision bundle with its own actions, status or comparison context | Short definitions, FAQ answers, source citations or decorative grouping |
| Divided row | Comparable records with the same fields, such as sources, projects or alert rules | Unrelated content that needs separate headings |
| Callout | A warning, limitation, verification step or important exception | General supporting copy or promotional framing |
| Plain section | Explanatory copy, definitions and editorial guidance | Dense interactive controls that need a boundary |

Before adding a card, ask whether a heading, spacing and a divider would communicate the same relationship with less visual weight. Repeated rounded rectangles flatten hierarchy and make the product look assembled from generic components.

## Page composition

- Start with the decision the user is making, not a feature label or technology name.
- Show one clear primary action for the current state. Secondary actions may be links, quiet buttons or later steps.
- Do not repeat global navigation inside a card unless the local context changes what the destination means.
- Put current, sourced housing information before general educational copy when both are present.
- Use icons to aid recognition, not as decoration above every heading.
- Vary density by purpose. A source list should be compact; an affordability decision deserves more space.

## Components & libraries

- **shadcn/ui + Tailwind CSS** as the component foundation (Base UI primitives underneath). Build the design tokens into the Tailwind theme from day one. Do not use ad hoc hex values in components.
- **MapLibre GL JS** for all maps. Use a custom light basemap. **Project polygons are the dominant layer** and everything else recedes.
- Icons: Lucide (ships with shadcn). Consistent stroke, no mixing icon families.
- Charts (price history, comparables): minimal, monochrome-navy with single teal highlight; no rainbow charts.

## Interaction principles

- **One primary action per screen.** Secondary actions are visually quieter.
- **Compare tray is persistent.** Adding to compare should feel like collecting, with a sticky tray that never requires hunting.
- **Immediate feedback:** every mutation shows optimistic or loading state; nothing ever feels dead.
- **URL is state:** filters, selected projects and compare sets are shareable via URL.
- **Empty states teach:** no blank boxes. Every empty state says what this is and what to do next, in one line.
- **Motion is purposeful:** subtle transitions for state changes only. No gratuitous animation, no parallax.
- **Mobile is designed, not squeezed:** use a bottom sheet over the map for lists and details, a full-screen planner and a sticky compare tray. Never shrink a desktop sidebar onto a phone.

## Mobile composition

- Design the 320 to 430 pixel layout first, then expand it. Do not rely on desktop wrapping as the mobile design.
- Keep the next useful action near the bottom of the active task, especially above the software keyboard in forms and chat.
- Use a single column for reading and decision flows. Keep side-by-side controls only when each label remains clear at 320 pixels.
- Reserve space for content that appears after hydration or data loading so headers and controls do not shift.
- Use at least 44 by 44 pixel touch targets for primary controls and icon buttons.
- Test long town names, large prices, missing data, signed-out state and the software keyboard before release.

## State matrix

Every feature must define these states before implementation. Reviewers should test them explicitly.

| State | Must show | Must offer | Never show |
|---|---|---|---|
| Loading | Stable layout and a clear indication of pending work | A safe way to leave or continue browsing | Blank space that later shifts surrounding controls |
| Empty | What the area is and why it is empty | One relevant next action | A decorative empty card with no instruction |
| Error | What failed in plain language and whether saved work is safe | Retry, recover or a clear fallback | A silent failure or raw technical message |
| Signed out | What works without an account | Sign in only when saving or history requires it | A blocked browsing or comparison flow without reason |
| Success | The changed inline state | The logical next step, when one exists | Toast-only confirmation for an important action |
| Partial data | Which facts are missing or stale | Source or verification guidance | Inferred values presented as official facts |

## AI UX rules

- Desktop: docked right panel. Mobile: full-screen sheet. Chat never covers the map entirely.
- **Citations inside answers**, always. Every project fact in an AI response links to its record. Do not present uncited claims.
- Show the interpreted constraints ("You said: 4-room, ≤ S$550k, ≤ 4 years") as chips so the user can correct the machine. **MVP form:** chips are read-only displays; correction happens naturally by replying in chat. The re-extracted constraints replace the chips. Inline chip editing is the V1.x upgrade.
- When data is missing or stale, the AI says so plainly. Confidence is a feature.

## Accessibility floor

- WCAG AA contrast everywhere; coral/teal never carry meaning alone (always paired with text/icon).
- Full keyboard navigation; visible focus states.
- Use semantic HTML and proper landmarks. This matters for accessibility and SEO.

## Copy style

- Write short, direct sentences in Singapore English.
- Name the housing decision or outcome. Do not lead with "AI," "smart" or other technology framing.
- Avoid generic confidence claims, repeated framing and filler introductions.
- Do not use em dashes. Prefer a full stop, comma or colon.
- Read every sentence aloud. If it sounds like product copy rather than a useful explanation, rewrite it.

## Anti-patterns (never ship)

- Information walls: 15 equal-weight stats in a grid
- Nested tabs hiding decision-relevant facts
- "AI says so" without a source link
- Modal-on-modal flows
- Toast-only confirmation of important actions (use inline state)
- Carousel anything
