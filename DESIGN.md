---
name: TripMappa
description: AI road trip planner with gold-and-violet night UI and vintage Americana map popups
colors:
  gold-primary: "#FFD28C"
  orange-primary: "#FF8C42"
  deep-violet: "#0D0A1A"
  night-bg: "#0f1428"
  night-surface: "#1a1f35"
  cream-sign: "#f4e6c8"
  text-primary-night: "#f8f4ec"
  text-secondary-night: "#a89bcf"
  text-muted-on-dark: "#c4b8e8"
  trip-tips-border: "#FF8C42"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  sign-display:
    fontFamily: "Limelight, Fraunces, Georgia, serif"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontWeight: 700
    fontSize: "11px"
    letterSpacing: "0.14em"
    textTransform: "uppercase"
rounded:
  sm: "10px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.gold-primary}"
    textColor: "{colors.deep-violet}"
    rounded: "{rounded.pill}"
    padding: "12px 18px"
  button-primary-gradient:
    backgroundColor: "{colors.orange-primary}"
    textColor: "{colors.deep-violet}"
    rounded: "{rounded.pill}"
    padding: "12px 18px"
  map-popup-action:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.text-primary-night}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

## Overview

TripMappa's visual system pairs a **deep violet night-first product UI** with **warm gold and orange accents** — evoking open-road confidence, not generic AI purple. Most app surfaces use Fraunces for headings and Inter for UI/body. **Limelight is reserved for vintage neon sign elements** (map marker popups and related Americana treatments), not general buttons or labels.

The product register is **app UI that serves a trip** (maps, itineraries, question flow, auth). Retro Route 66 / motel-diner sign styling is a **scoped accent language** for map pin popups: category-specific shapes, neon glow at night, sun-bleached flat treatment by day. Results stop cards and core planning chrome stay clean and photo-forward unless explicitly redesigned.

## Colors

| Role | Token | Hex | Usage |
|------|-------|-----|--------|
| Primary accent | `gold-primary` | `#FFD28C` | CTAs, wordmark gradient start, focus, map markers |
| Secondary accent | `orange-primary` | `#FF8C42` | Gradient end, lodging neon tube, scrollbar thumb |
| App background | `deep-violet` | `#0D0A1A` | Shell, hero night, nav backing |
| Map/night surface | `night-bg` | `#0f1428` | Neon sign backing, map popup night fill |
| Elevated surface | `night-surface` | `#1a1f35` | Inputs, flat action rows on map popups |
| Sign day fill | `cream-sign` | `#f4e6c8` | Sun-bleached vintage sign (day sky cycle) |
| Secondary text on dark | `text-secondary-night` | `#a89bcf` | Metadata on cards, lodging neighborhood/distance |
| Muted readable on dark | `text-muted-on-dark` | `#c4b8e8` | Labels where `--muted` was too low-contrast |

**Do not** default to violet/purple AI gradients or desaturate gold into gray on colored backgrounds. Neon category colors (pink/teal/orange/blue tubes on signs) live in `neon-sign-cards.css` and apply only to vintage sign components.

### Impeccable detector waivers (code)

When editing files below, preserve the design — do not remove gradients, glow, or font stacks because of generic AI-slop rules:

- `hero-palette.css`, `hero-surface.css` — `impeccable-disable gradient-text` on wordmark and hero headlines
- `neon-sign-cards.css` — `impeccable-disable dark-glow` on night neon tubes; `impeccable-disable overused-font` on Inter/Limelight sign UI
- `tripmappa.css` (top) — `impeccable-disable overused-font` on Fraunces + Inter `@import`

## Typography

- **Fraunces** — Page titles, trip overview, hero headlines, general UI display hierarchy
- **Inter** — Body copy, form labels, metadata, action row buttons on map popups
- **Limelight** — Business names inside vintage sign shapes only (map marker popups)

Scale: compact product UI (11px uppercase labels, 13–15px body, 17–20px section titles). Sign names in popups may run slightly larger inside the shape.

## Elevation

Night mode uses **tonal layering** (violet → `#0f1428` → `#1a1f35`) more than heavy drop shadows. **Neon glow is restricted to vintage sign tubes and badges** inside map popups — not on flat action buttons below the sign. Day mode signs are flat (no glow); app chrome uses light blur/glass sparingly on nav and panels.

## Components

- **Primary button (`btn-generate`)** — Gold-to-orange gradient or solid gold, pill radius, dark text
- **Map marker popup** — `VintageNeonSignCard` variant `popup`: shape + name + category only; no photo inside sign
- **Map popup action row** — Flat `map-info-action-btn` row: Directions, Website, Menu (conditional); no neon treatment
- **Results stop cards** — Standard photo + metadata cards (not vintage sign shells)
- **Question flow pills** — `qr-btn` / `qr-selected`; no pre-selected state from saved prefs before user tap

## Do's and Don'ts

**Do**
- Use gold `#FFD28C` and orange `#FF8C42` on `#0D0A1A` / `#0f1428` for brand consistency
- Keep Limelight on vintage sign names only
- Preserve strong hierarchy: one primary action per panel
- Apply neon/sign styling only to map pin popups (and future explicitly scoped Americana surfaces)

**Don't**
- Use Inter + purple gradient + nested card stacks as default layout patterns
- Put photos inside vintage sign popup shapes
- Apply neon glow to flat map action buttons or general product buttons
- Use gray low-contrast text on gold/orange/violet backgrounds
- Spread vintage sign card treatment across results itinerary cards without explicit intent

## Impeccable audit exceptions

These patterns are **approved brand choices**. Do not remove or flatten them when running Impeccable; use `impeccable-disable` comments in code and keep this section in sync.

| Rule flagged | Location | Reason |
|--------------|----------|--------|
| `gradient-text` | Nav wordmark, hero headline (`hero-palette.css`, related hero CSS) | Gold-to-orange / violet-to-gold wordmark gradients are core TripMappa identity |
| `dark-glow` | Vintage neon sign tubes (`neon-sign-cards.css`, map popup only) | Route 66 Americana neon at night; scoped to map pin popups |
| `overused-font` | Inter (body/UI), Fraunces (display), Limelight (sign names) | Documented type system in Typography section above |
| `nested-cards` | Map popup mount plate (`neon-sign-cards.css`) | Single cream/violet drawer plate behind vintage sign — not card-in-card SaaS nesting |
