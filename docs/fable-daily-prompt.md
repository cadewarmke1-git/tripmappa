# TripMappa — One Fable prompt per day

Copy the entire block below (including the `---` lines) into Claude/Fable in **one message**. Do not paste API keys, `.env` values, source code, or real user data.

Replace `[TODAY'S NOTES]` with anything you observed today (optional, 1–3 sentences).

---

```
You are the strategic reviewer for TripMappa (tripmappa.com) — a live road-trip planner. I have ONE message today; give your full answer in this reply. I am NOT sharing code, keys, or credentials. Work only from this brief.

═══ PRODUCT ═══
Users answer a deterministic question flow (vehicle, party, lodging, dietary, schedule, interests — NOT LLM-driven). App routes on Google Maps, prefetches real Places along the driving corridor, then calls Anthropic Sonnet server-side to produce multi-day itineraries: overnight stops, hotels, restaurants, fuel/EV, truck HOS, tips. Results enrich with weather/POIs; users can save trips, live-share location, and collaborate via invite links. Revenue: trip-generation credits + Stripe tiers (Wanderer free → Voyager → Trailblazer → Founder).

═══ STACK ═══
React 19 + Vite 8 frontend · Vercel serverless API router → route handlers · Supabase Auth + Postgres + RLS · Google Maps client-side · Anthropic server-side only · Stripe · Twilio SMS · Vitest 219 tests · Playwright 7 e2e · question-flow audit script (315 simulations, 0-defect gate).

═══ ARCHITECTURE (module names only) ═══
• tripFlow.js — branching questions per Car/RV/Truck/Plane/Boat/Multi
• placesContext.js — corridor Places prefetch (anti-hallucination input to Sonnet)
• tripConstraintsSummary.js + planSnapshotDiff.js — generation hints + regenerate directives
• plan-trip.js — Sonnet prompts, vehicle blocks, JSON schema, SSE stream; credits on success only
• tripResponseNormalize.js — schema coercion + verify business names vs placesContext
• App.jsx — main orchestrator (state, generate, enrich, results)
• TripResultsPanel + PersonalTouchesSection — itinerary UI
• collaboration.js + /collab/:token — group input before regenerate
• apiSecurity + rate limits + vercel.json CSP/HSTS — recent hardening
• Migrations 014–016 applied: collaboration, OTP attempt tracking, RLS (anon cannot SELECT live_trips/collaborations; token RPCs instead)

═══ RECENTLY SHIPPED ═══
Collaboration invites · security audit (auth on plan-trip/Claude/SOS/location, proxy rate limits, webhook idempotency, generic 500s) · hamburger removed (nav in avatar menu) · plan-flow UX (kids ages earlier, nights before lodging, day-trip skips, boat destination interests, friendlier copy) · generation quality (pre-output verification checklist, verified/price_band on hotels, post-parse name check, chain/rating filters on Places prefetch, REGENERATION DIRECTIVES with YOU MUST lines, personal_touches + changes_made in JSON and results UI).

═══ GENERATION PIPELINE (where quality matters) ═══
Client builds placesContext → sends placesContextPrompt + generationHints + user prefs rollup + optional regenerate directive block → server builds vehicle-specific Sonnet prompt with universal rules (corridor-only stops, dietary/medical/schedule, lodging tier dollar bands) → model returns JSON → server normalizes and flags unverified business names → client shows itinerary + "Personalized for you" touches.

Model: claude-sonnet-4-6 (server allowlist). Fallback trip data path must stay when API fails.

═══ DEFERRED (good targets for your advice) ═══
Prior-trip stop exclusion on regenerate (~30% reuse budget) · anchor-city POI scoring · truck arrive-by/HOS copy polish · monetization gates (paid collab regenerate, cross-trip memory) · live Booking.com/OpenTable/GasBuddy (no keys yet).

═══ HARD CONSTRAINTS (never recommend violating) ═══
• Anthropic key stays server-only; no client-side LLM
• Do not broaden anon Supabase reads on live_trips or trip_collaborations
• Do not remove fallback itinerary path
• Question-flow changes must keep audit-question-flow.mjs at 0 defects
• Prefer surgical slices over rewrites; implementer runs npm test + build before ship

═══ MY NOTES TODAY ═══
[TODAY'S NOTES]

═══ YOUR DELIVERABLE (complete in one response) ═══

1. RANKED BACKLOG — max 8 items, labeled P0/P1/P2. Each item must include:
   • User-visible outcome (one sentence)
   • Which module area to touch (from architecture list)
   • Why now (impact vs effort)
   • Risk if done wrong
   • Minimal test plan (which npm/audit commands)

2. ONE ARCHITECTURE VERDICT — keep App.jsx as orchestrator vs extract generation/enrichment into a dedicated state layer. Pick one and defend in ≤5 sentences.

3. LAUNCH QA MATRIX — table: rows = vehicle types (Car, RV, Truck, Plane, Boat), columns = trip length (day / medium / multi-day) + one dietary edge case. Mark cells Must-test-before-launch vs Nice-to-have.

4. DO NOT DO LIST — ≥5 recommendations that would harm security, hallucination control, or credit integrity.

5. SINGLE NEXT SLICE — the one cohesive chunk of work to implement in the next coding session (≤1 day of dev), scoped so it does not require product decisions from me.

Be specific and opinionated. No generic startup advice. No requests for code or keys.
```

---

**Do not paste:** env values, API keys, full files, migration SQL, real tokens/PII, admin IDs.
