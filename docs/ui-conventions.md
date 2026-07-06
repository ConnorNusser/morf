# UI formatting conventions

The home and history tabs (and anything new) draw every formatting decision
from one shared layer instead of per-file literals. The layer has three
levels — tokens, the themed Text, and composite primitives. If you're about
to write a `fontSize:`, a `color: theme.colors.text + "50"`, or a
`borderRadius: 12`, stop: the value you want already has a name.

## 1. Tokens — `lib/ui/tokens.ts` + `lib/ui/typography.ts`

| Token | Values | Use for |
| --- | --- | --- |
| `type` (typography.ts) | meta 14 · body 16 · emphasis 18 · title 20 · heading 22 · statHero 26 · screenTitle 30 · hero 30 · header 38 | every fontSize; 14 is the floor — nothing renders smaller |
| ink ramp | primary · secondary (60%) · muted (40%) · faint (30%) · ghost (15%) · hairline (8%) | every use of theme text color at reduced emphasis |
| `tint(color)` | 12% wash | badge / delta-pill backgrounds behind an accent color |
| `space` | xs 4 · sm 8 · md 12 · lg 16 · xl 20 · section 24 | margins, paddings, gaps |
| `radius` | badge 6 · control 10 · card 12 · pill 999 | corner radius by element role |
| `screenGutter` | 20 | the horizontal page gutter on every tab |

Never write a raw alpha suffix (`+ "50"`). Never pick a one-off spacing or
radius number — snap to the nearest token; consistency beats a 2px
preference (explicit product decision).

## 2. Text — `components/Themed.tsx`

```tsx
<Text variant="meta" tone="faint" weight="medium">Sets logged</Text>
```

- `variant` — type-scale role (sets fontSize). Named `variant` because RN
  claims `role` for accessibility.
- `tone` — ink emphasis (sets color). Omit it to get the theme primary
  (accent) color — that's the legacy default, used for accent numbers.
- `weight` — regular / medium / semiBold / bold.

StyleSheets carry **layout only** (flex, margins, letterSpacing…). If a
style entry contains `fontSize`, `fontWeight`, or a text `color`, it should
be props instead.

For icons, `TextInput`s, borders, and rules, get the same ramp with:

```tsx
const ink = useInk();           // from components/Themed
<Ionicons color={ink.muted} … />
```

## 3. Composite primitives — `components/ui/`

One component per repeated pattern; don't re-implement these inline:

- **SectionLabel** — the uppercase micro-label that introduces a section
  (YOUR LIFTS / RECORDS / Career sections).
- **NavRow** — label + chevron drill-down row; `variant="plain"` on the
  page, `variant="card"` on a bordered surface.
- **EmptyState** — ghost icon, faint headline, optional fine print and
  pill CTA.
- **Divider** — the one horizontal rule (hairline in `ink.hairline`).
- **StatStrip** — value-over-label stats in a row on a surface, split by
  hairlines.
- **SegmentedTabs** — underline tab switcher (History's Workouts /
  Exercises header).
- **Chip** (`components/Chip.tsx`) — pill filter/sort chip; selected =
  primary fill.

## Review checklist

- [ ] No `fontSize:`/`fontWeight:` in a StyleSheet that Text props could carry
- [ ] No `colors.text + "XX"` — tones or `useInk()`
- [ ] No literal spacing/radius where a token fits
- [ ] No inline copy of a `components/ui` primitive
- [ ] No `backgroundColor: "transparent"` on Themed `View` (it paints none)
