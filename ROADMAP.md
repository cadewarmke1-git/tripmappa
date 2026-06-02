# TripMappa — Project Roadmap

**Live:** [tripmappa.com](https://tripmappa.com) (Vercel)  
**Stack:** React 19 · Vite 8 · Google Maps · Vercel serverless · Anthropic (server-side only)

This document is the single source of truth for project status, upcoming work, and codebase conventions. Read this before starting any session.

---

## Current Status

**Phases 1–2 are complete.** The app is live with real map routing, a deterministic planning flow, trucker/RV/family features, a budget card, and a full modular refactor.

**Human-thought / recovery layer (no external APIs): complete.** Credits charge only on success, fallback trips are labeled, route failures unblock the flow, stale answers prune on branch changes, map add/remove trip works, generation and enrichment can be cancelled, edit-plan stale banners prompt regenerate, dietary/safe-stops/medical/schedule/wheelchair lodging preferences feed Places and alerts, and placeholder Reserve/SMS/booking buttons are honestly labeled.

**Current period:** Pre–external-API polish. Lodging cards use Google Places; live Booking.com, OpenTable, Twilio SMS, and GasBuddy pricing await API keys (Phases 3–9 in roadmap below).

| Recent human-thought fixes | Location |
|-----|----------|
| Plan stale detection + regenerate banner | `src/lib/planSnapshot.js`, `StalePlanNotice.jsx` |
| Schedule restrictions + drive-hours question | `src/lib/scheduleRestrictions.js`, `tripFlow.js` |
| Medical needs (dialysis, vet, pharmacy alerts) | `tripAccommodations.js`, `tripAlerts.js` |
| Wheelchair lodging filter | `placesSearch.js` |
| Prayer facilities POI search | `placesSearch.js`, `tripEnrichment.js` |
| Towing → avoid highways/ferries routing | `App.jsx` `fetchDirections` |
| Add-to-trip undo toast | `App.jsx` |
| Honest Reserve/SMS/booking labels | restaurant/lodging/share components |
| Sonnet `generationHints` + richer placesContext | `tripConstraintsSummary.js`, `placesContext.js`, `plan-trip.js` |
| Plan change diff + constraints bar on results | `planSnapshotDiff.js`, `TripConstraintsBar.jsx` |
| Config missing-key banner | `ConfigWarningBanner.jsx` |

---

## Architecture

```
api/plan-trip.js     → Active: Sonnet trip generation (POST only)
api/claude.js        → Legacy Haiku proxy — no frontend callers

src/App.jsx          → Orchestrator (~710 lines): state, effects, handlers, layout
src/lib/             → Business logic (10 modules)
src/components/      → UI (20 components)
src/styles/          → tripmappa.css + tripmappa-themes.css
```

### Question flow (deterministic, 5 steps)

Managed in `src/lib/tripFlow.js`:

1. `trip_type` → 2. `vehicle` → 3. `travelers` → 4. `lodging` → 5. `preferences`

Inline sub-flows: truck specs (height/weight/hazmat), RV specs, kids ages, multi-select preferences.

### Key features (shipped)

- Google Directions routing with truck/RV/scenic/water variants
- HOS compliance for commercial drivers (`src/lib/hos.js`)
- Animated budget card (`src/components/BudgetCard.jsx`, `src/lib/budget.js`)
- Fallback stop/safety data when API fails (`src/lib/tripData.js`) — **never remove**
- Theme auto-switch (day/night) with frosted-glass planner UI

---

## Phase Roadmap

| Phase | Name | Status | Summary |
|-------|------|--------|---------|
| **1** | Foundation | ✅ Done | Hero, planner shell, Vercel deploy, initial UI |
| **2** | Real Map & Planning | ✅ Done | Google Maps, 5-question flow, trucker/RV/family, budget card, modular refactor |
| **—** | Pre–Phase 3 polish | ✅ Done | Hero, swap button, map dark mode, mobile panel height (see table above) |
| **3** | Lodging & Hotel APIs | 🔜 Next | Booking.com affiliate API — live hotel cards (prices, photos, ratings, availability); Book button → affiliate links |
| **4** | Fuel & EV Charging | Planned | NREL API (EV stations); GasBuddy or similar (live fuel prices along route) |
| **5** | Restaurants | Planned | Yelp Fusion API (recommendations at stops); OpenTable or Resy (reservations) |
| **6** | User Accounts & Saved Trips | 🔜 In progress | Supabase Auth (email + OAuth); `trips` table; Save Trip wired |
| **7** | Live Location Sharing | Planned | Supabase Realtime (GPS every 30s); shared read-only map via unique link; Twilio SMS invites |
| **8** | Grocery Delivery | Planned | Instacart Storefront API (DoorDash Drive backup); Web Speech API voice-to-list; deliver to hotel |
| **9** | Truck & Oversized Routing | Planned | HERE Maps Truck Routing (height/weight/hazmat); Trucker Path API (parking); Reserve Parking button |
| **10** | Monetization | Planned | Booking.com + Hotels.com affiliate commissions; Stripe $7.99/mo premium; premium gate; B2B white-label outline |
| **11** | Launch | Planned | SEO meta tags; Google Search Console; Product Hunt; early user outreach |
| **12** | Travel Tips Tab | Planned | Tomorrow.io or OpenWeatherMap (weather); Google Roads or HERE Traffic (incidents/closures); police/speed traps; AI reroute on hazards |
| **13** | Live Tracking API | Planned | Production live location tracking (replaces demo Share panel) |

---

## Money Model

1. **Affiliate commissions** — hotel bookings (Booking.com, Hotels.com) and restaurant reservations
2. **Premium subscription** — $7.99/month via Stripe
3. **B2B white-label** — licensed deployments for fleet/travel companies

Placeholder toasts in the UI reference the phase when each feature ships (e.g. Save Trip → Phase 6, Reserve Parking → Phase 9).

---

## Conventions (required)

### API & AI

- **Never call the Anthropic API from the frontend.**
- All AI requests go through `src/lib/apiClient.js` → `/api/plan-trip` (or a new serverless route in `api/`).
- `api/claude.js` is legacy; do not add new frontend callers.

### Code organization

| What | Where |
|------|-------|
| New UI | `src/components/` |
| New logic | `src/lib/` |
| New styles | `src/styles/tripmappa.css` (themes in `tripmappa-themes.css`) |
| New serverless endpoints | `api/` |

### Data

- **Never remove fallback stop data** in `src/lib/tripData.js`. The app depends on it when `/api/plan-trip` fails or returns partial results.

### Environment

Set variables in `.env.local` locally and in Vercel manually (see `.env.example`). Never hardcode keys.

**Frontend** — `import.meta.env.VITE_*` only:

- `VITE_GOOGLE_MAPS_KEY` — Google Maps
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key

**Serverless (`api/`)** — `process.env.*` only:

- `ANTHROPIC_KEY` — trip generation
- `SUPABASE_URL` — Supabase project URL for admin client
- `SUPABASE_SERVICE_ROLE_KEY` — admin Supabase access (via `api/lib/supabaseAdmin.js`)
- `NREL_API_KEY` — EV charging enrichment

### Build & deploy

```bash
npm run dev      # local development
npm run build    # production build
```

Deploys automatically to Vercel on push to `main`. Production URL: **tripmappa.com**.

---

## File Reference (quick)

| File | Role |
|------|------|
| `src/App.jsx` | Root orchestrator — state, routing, question handlers, layout |
| `src/lib/tripFlow.js` | Question definitions and flow logic |
| `src/lib/tripHandlers.js` | Trip API response parsing and fallback builder |
| `src/lib/apiClient.js` | Frontend → `/api/plan-trip` |
| `src/lib/tripData.js` | Fallback stops, truck/RV safety data |
| `src/components/PlanPanel.jsx` | Planner shell (questions, budget, route footer) |
| `src/components/QuestionChoices.jsx` | Choice buttons and inline spec forms |
| `src/components/StopsResults.jsx` | Generated trip stops and action buttons |
| `src/components/HeroView.jsx` | Landing hero and route search |
| `src/components/AppMap.jsx` | Google Map with theme-aware styles |

---

*Last updated: May 2026 — post Phase 2 refactor and pre–Phase 3 polish.*
