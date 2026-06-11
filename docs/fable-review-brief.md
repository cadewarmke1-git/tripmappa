# TripMappa — Fable Review Brief (safe to paste into LLM chat)

**Purpose:** Give Claude/Fable enough product and architecture context to recommend meaningful improvements and structural changes **without** pasting secrets, credentials, or proprietary implementation detail.

**Last updated:** 2026-05-31 · **Latest deploy commit themes:** results layout stabilization + plan-choice prefill fix (`61eb44e` on `main`); prior batch added collaboration, security, generation quality, cinematic loader

---

## ⛔ Do NOT paste into any chatbot

| Category | Examples |
|----------|----------|
| API keys / secrets | `ANTHROPIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret/webhook signing secret, Twilio auth token, NREL/Instacart keys |
| Client env values | Actual `VITE_*` values from `.env` or Vercel dashboard |
| Database connection strings | Supabase project URL + keys as literals |
| User data | Real emails, phones, trip payloads, share tokens, live-trip tokens |
| Full source files | Entire `App.jsx`, `plan-trip.js`, or migration SQL dumps |
| Security bypass details | Exact rate-limit thresholds, admin user ID lists, OTP hash internals |

**Safe to describe:** module names, data flow, table *names*, RLS *policies in plain English*, feature behavior, UX goals, test commands, deferred work.

---

## Product in one paragraph

**TripMappa** is a road-trip planning web app (live at tripmappa.com) that asks users a deterministic question flow (vehicle, party, lodging, dietary, schedule, interests), routes them on Google Maps, prefetches real Places along the corridor, then calls **Anthropic Sonnet server-side** to produce a multi-day itinerary (overnight stops, hotels, restaurants, fuel/EV, truck HOS, tips). Results enrich with weather, optional POIs, live sharing, and collaboration. Monetization: trip-generation credits + Stripe tiers (Wanderer / Voyager / Trailblazer / Founder).

---

## Stack (no versions required in chat)

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, vanilla CSS themes (day/night) |
| Maps | Google Maps JS API (Directions, Places client-side) |
| Backend | Vercel serverless — single `api/router.js` dispatches to `server/routes/*` |
| Auth & DB | Supabase (Auth + Postgres + RLS) |
| LLM | Anthropic Messages API — **only** on server (`plan-trip`, legacy `claude` proxy) |
| Payments | Stripe Checkout + webhooks |
| SMS | Twilio (OTP, live-share follower alerts, SOS) |
| Tests | Vitest (219 unit tests), Playwright (7 e2e), `scripts/audit-question-flow.mjs` (315 sims, 0 defects target) |

---

## High-level architecture

```
User browser
  ├─ Question flow (deterministic)     → src/lib/tripFlow.js
  ├─ Google Directions + Places        → client (maps key is public VITE_* only)
  ├─ Places corridor prefetch          → src/lib/placesContext.js (anti-hallucination)
  ├─ Generation hints assembly         → src/lib/tripConstraintsSummary.js
  └─ POST /api/plan-trip (SSE stream)  → server/routes/plan-trip.js
        ├─ Builds vehicle-specific Sonnet system + user prompts
        ├─ Injects placesContextPrompt + generationHints + user prefs rollup
        ├─ Parses JSON → server/lib/tripResponseNormalize.js (schema coercion + name verification)
        └─ Charges trip credit only after successful parse

Results UI
  ├─ TripResultsPanel (itinerary days, lodging pick, road stops)
  ├─ PersonalTouchesSection (new: personal_touches + changes_made from model)
  ├─ StalePlanNotice when user edits answers after generation
  └─ Enrichment pass (restaurants, weather, activities by city)
```

**Orchestrator:** `src/App.jsx` holds most state/effects (large but modularized into `src/lib/*`).

---

## Question flow (vehicles & branching)

Managed in `tripFlow.js` — **not** LLM-driven for questions.

| Vehicle families | Branch highlights |
|------------------|-------------------|
| Car / SUV / Motorcycle / Rental | Fuel, towing (day trips skip towing + route prefs if &lt;150 mi), kids ages early, nights before lodging |
| Semi / commercial | Hauling, sleeper cab, truck stop brand, HOS-aware generation |
| RV | Towing, hookups, propane/dump concerns |
| Plane / Boat / Ferry | Simplified destination-focused plan (skip road corridor rules) |
| Multi-vehicle | Coordination needs, primary vehicle for routing |

**Audit gate:** `node scripts/audit-question-flow.mjs` must stay at **0 defects** after flow edits.

---

## Trip generation pipeline (where quality work lives)

1. **Client** builds `placesContext` (corridor samples every ~30 mi + overnight city hotels/restaurants/medical).
2. **Client** sends `placesContextPrompt`, `generationHints`, `recentTripsPreferencesRollup`, optional `regenerateDiffBlock`.
3. **Server** `plan-trip.js`:
   - Vehicle-specific prompt blocks (commercial, RV, plane, water, multi, personal).
   - `buildUniversalRules()` — corridor rule, dietary, medical, budget, **pre-output verification checklist**.
   - JSON schema demands `verified`, `price_band` on hotels, `personal_touches` array.
   - On regenerate: `REGENERATION DIRECTIVES` with `YOU MUST:` lines + `changes_made` in JSON.
4. **Normalize** cross-checks business names against placesContext; sets `verified` false on hallucinated names.
5. **Client** `parseTripApiResponse` → results + persistence.

**Model:** `claude-sonnet-4-6` (allowlisted server-side). Credits consumed only after valid response.

---

## Security posture (patterns, not config values)

- All sensitive API routes require auth + `x-tripmappa-client: web` header.
- Rate limits on plan-trip, Claude proxy, geocode/restaurants/weather proxies, OTP send/verify.
- `live_trips` / `trip_collaborations`: anon SELECT revoked; token-scoped RPCs for reads.
- Stripe webhooks: signature verification + idempotency table `stripe_webhook_events`.
- Generic 500 bodies on router — no `err.message` leak.
- CSP + HSTS + X-Frame-Options in `vercel.json`.
- Follower phones capped; PII redacted on collaboration invitees.

**When Fable suggests changes:** must not weaken auth, broaden anon DB access, or expose LLM keys client-side.

---

## Database concepts (table names only)

| Table / RPC | Role |
|-------------|------|
| `trips` | Saved user itineraries (JSON payload) |
| `user_trip_preferences` | Learned defaults across trips |
| `live_trips` | Live location share sessions |
| `trip_collaborations` | Group edit + invite tokens |
| `stripe_webhook_events` | Webhook idempotency |
| `sms_otp_verify_attempts` | OTP brute-force tracking |
| `generation_logs` | Token usage logging (admin) |
| RPC `get_live_trip_by_share_token` | Token-scoped live trip read |
| RPC `get_trip_collaboration_by_invite_token` | Token-scoped collab read |

Migrations `014`–`016` applied in prod (collaboration, OTP attempts, security RLS).

---

## Features shipped (recent sessions)

### Collaboration
- Invite link `/collab/:token`, panel on Share + results footer.
- API `server/routes/collaboration.js`; realtime via polling (not broad anon Supabase subs).

### Navigation
- Hamburger removed; all nav in 72px avatar dropdown (`NavProfileMenu`).

### Security audit (surgical)
- Shared libs: `apiRateLimit`, `apiSecurity`, `tripmappaHeaders`.
- Hardened: plan-trip auth, SOS, location updates, proxy routes, OTP limits, webhook idempotency.

### Plan-flow UX
- Kids ages after party composition; nights before lodging; day-trip skips; boat gets destination interests; friendlier copy.

### Generation quality (latest commit)
- Pre-output verification checklist in prompts.
- `verified` / `price_band` on stops; post-parse name check vs placesContext.
- Places prefetch: rating band + chain exclusion (except fast-food preference).
- Regenerate: directive block + `changes_made` field.
- UI: **Personalized for you** section (`personal_touches`, `changes_made`).

---

## Explicitly deferred (good Fable targets)

| Item | Why deferred |
|------|----------------|
| Prior-trip exclusion list (~30% reuse budget on regenerate) | Needs memory model + prompt budget |
| Anchor-city POI scoring along route | Larger retrieval/ranking layer |
| Truck arrive-by / HOS copy polish | Prompt-only; lower ROI than verification |
| Monetization gates (collab regen paid, memory Voyager+) | Product decision |
| Booking.com / OpenTable live booking | Awaits affiliate/API agreements |
| GasBuddy live fuel | Awaits API key |

---

## Quality gates (run before shipping Fable-inspired code)

```bash
npm test                    # 300+ unit tests
npm run test:e2e            # Playwright (chromium)
npm run build               # Vite production build
node scripts/audit-question-flow.mjs   # 0 defects
npm audit                   # 0 vulnerabilities target
```

**Principle for implementer (Cursor agent):** surgical diffs only; match existing conventions; no over-engineering; don't commit unless asked.

---

## Fable ↔ Cursor handoff (read this before any review cycle)

**Copy-paste one-pager:** [`docs/fable-handoff-templates.md`](fable-handoff-templates.md) — starter prompt, Fable→Cursor, Cursor→Fable, file picker, budget line.

**Critical constraint:** Fable has **no view of the repo**. It only sees screenshots, this brief, and summaries you paste. Cursor has full code access but only sees the **last message** unless you paste history.

That gap is why broad prompts ("redesign trip output") became ~12k lines of new components, CSS layers, and loaders — Fable diagnosed correctly (too much scroll), but neither side enforced *edit existing files, stay in budget*.

### Roles

| Role | Good at | Not good at |
|------|---------|-------------|
| **Fable** | UX diagnosis, prioritization, launch readiness, "does this feel right?" from screenshots | Knowing which components already exist, diff size, CSS conflicts, test surface |
| **Cursor** | Surgical implementation in named files, tests, build | Guessing product intent from vague "make it cinematic" prompts |

### One cycle, one problem

Each cycle should fix **one screen, one problem**. Examples:

- ✅ "Fuel step shows Tesla pre-selected before I answer" → plan choices / prefill only
- ✅ "Results summary scrolls away; stop list is endless" → `TripResultsPanel` layout only
- ❌ "Redesign trip generation output" (spans results + loader + map + plan CSS)

**Rule:** One Fable theme per session → one focused Cursor task → screenshot back to Fable. Do not stack five product areas in one night.

### Default out of scope (unless explicitly listed in the task)

| Area | Primary paths | Why protected |
|------|---------------|---------------|
| Plan question panel layout/CSS | `PlanPanel.jsx`, `QuestionChoices.jsx`, `plan-flow` styles in `tripmappa.css` / `rebrand.css` | CSS override wars; prefill/history bugs |
| Generation loader | `GenerationCinematicLoader.jsx`, Three.js loader | Heavy dep; unrelated to most UX fixes |
| Map ↔ itinerary DnD sync | `useItinerarySync.js`, map drag handlers | Large surface; defer unless task is map editing |
| New npm dependencies | `package.json` | Needs explicit approval |
| `App.jsx` orchestration | `src/App.jsx` | Touch only when task names a specific state/effect |
| Collaboration / security / credits | `server/routes/collaboration.js`, `apiSecurity.js`, `tripCredits.js` | Already shipped; don't regress |

### In scope for "results / output" tasks (prefer editing these)

| Goal | Start here | Notes |
|------|------------|-------|
| Fixed summary + scrollable stops | `TripResultsPanel.jsx` | Current pattern: compact `TripOverviewHero` + `JourneyTimeline` |
| Day sections / stop cards | `ResultsDaySection.jsx`, `JourneyTimeline.jsx` | Avoid new parallel timeline components |
| Personalization strip | `PersonalTouchesStrip.jsx` / touches in results | Don't duplicate with another hero |
| Generation quality / hallucination | `server/routes/plan-trip.js`, `tripResponseNormalize.js` | Server-side; no results CSS unless displaying new fields |
| Plan choice prefill | `QuestionChoices.jsx`, `generationContext.js`, `App.jsx` (prefill strip only) | Selection = confirmed `questionHistory` only |

### Implementation budget (paste into every Cursor task)

Unless you override in the task message:

- **Max ~3 files** touched (name them in the prompt)
- **Max ~200 lines** net change unless you approve a larger diff
- **No new top-level components** without explicit approval — extend existing ones
- **No new CSS files** — edit existing theme CSS only
- **Must pass** `npm test`, `npm run build` before done
- **Do not commit or push** unless you ask

### Anti-patterns (learned from Jun 2026 batch)

| Fable-ish ask | What went wrong | Better Cursor instruction |
|---------------|-----------------|---------------------------|
| "Split summary from stops" | New `ResultsHero` + 5 variants + reveal animations | "In `TripResultsPanel.jsx` only: fixed top ~36vh, timeline scrolls below" |
| "More personalized output" | `PlannedForYouSection` + hero wiring + duplicate chips | "Surface `personal_touches` in existing touches strip; no new section component" |
| "Loader feels broken" | 1,050-line Three.js cinematic loader | "Tune `RouteDrawingLoader` CSS; do not add Three.js" |
| "Improve mobile results" | Plan-flow bottom-sheet CSS changed in same pass | "Results CSS only; do not edit plan-flow or `PlanPanel`" |

### Paste template: Fable → Cursor

Copy and fill after a Fable session:

```
Implement ONE item from Fable review — surgical diff only.

**User-visible outcome:** [one sentence, e.g. "Summary stays visible; only stops scroll"]
**Problem screenshot:** [attached or described]

**In scope (edit only these):**
- [file 1]
- [file 2]
- [optional file 3]

**Out of scope (do not touch):**
- PlanPanel / question flow CSS
- GenerationCinematicLoader / Three.js
- useItinerarySync / map DnD
- App.jsx unless listed above
- New components, new npm deps, new CSS files

**Budget:** ≤3 files, ≤200 lines net unless I say otherwise.
**Approach:** Extend existing components; do not create parallel replacements.
**Verify:** npm test && npm run build. No commit unless I ask.

**Fable recommendation (outcomes only — do not treat as file-level spec):**
[paste Fable's diagnosis + desired UX, NOT its guessed component names]
```

### Paste template: Cursor → Fable

After implementation, feed Fable evidence — not a code dump:

```
**What we shipped:** [1–2 sentences]
**Commit:** [hash or "local only"]
**Files touched:** [list — Fable cannot see these otherwise]
**Screenshots:** [before/after, mobile + desktop if relevant]
**Still broken / open:** [honest list]
**Deferred on purpose:** [what we chose not to do and why]

Question for Fable: [one specific UX question, not "redesign everything"]
```

### What to give Fable in the first message

Safe and high-value:

- This brief (or the starter prompt below)
- **One** screenshot per problem (annotate what feels wrong)
- Outcome you want ("less scrolling"), not implementation ("build JourneyTimeline")
- Repo map **area names** only (e.g. "results panel") — not full file contents

Avoid feeding Fable:

- "Implement exactly what you described last time" without file/budget guardrails
- Multi-area wishlists in one prompt
- Assumption that Fable knows what is already in production after your Cursor fixes

### Fable output format to request

Ask Fable to return recommendations in this shape (reduces greenfield guessing):

1. **P0–P2 rank** — one line each
2. **User-visible outcome** — what the traveler sees
3. **Surface area** — e.g. "results layout", "plan-trip prompts" (not invented component names)
4. **Out of scope for this item** — what not to change in the same pass
5. **Manual test plan** — 3–5 steps with vehicle/device notes
6. **Risk** — security, hallucination, regression on question flow audit

---

## Tier / credits model (for product advice)

| Tier | Rough positioning |
|------|-------------------|
| Wanderer | Free / guest — limited trip generations |
| Voyager | Paid — more generations + features |
| Trailblazer | Higher tier |
| Founder | Promotional Trailblazer-equivalent |

Credits charged **only** on successful plan-trip completion. Guest credits tracked client-side with upgrade prompts.

---

## Open questions worth Fable's opinion

1. **Generation:** Is `personal_touches` the right perceived-personalization surface, or should a short narrative "traveler dossier" appear earlier in the flow?
2. **Regenerate:** How aggressive should prior-stop exclusion be without feeling like a completely new trip?
3. **Places prefetch:** Should chain filtering be preference-aware beyond fast-food (e.g. allow McDonald's for families with toddlers)?
4. **Structure:** Is `App.jsx` still the right orchestrator, or should generation/enrichment move to a dedicated state machine / context provider?
5. **Launch:** What manual QA matrix (vehicle × distance × dietary × mobile) matters most before creator wave?
6. **Monetization:** Which gates (collab regenerate, cross-trip memory, grocery) belong in Voyager vs Trailblazer?

---

## Starter prompt for tomorrow's Fable session

Copy everything below the line into a new Claude chat:

---

You are reviewing **TripMappa**, a production road-trip planner (React + Vercel + Supabase + server-side Sonnet). I will NOT share source code, API keys, or credentials. Use only this brief.

**Your job:**
1. Recommend **prioritized** improvements (generation quality, UX, architecture, launch readiness).
2. Flag anything that would **weaken security** or **increase hallucination risk**.
3. Propose **structural** changes only when ROI is clear; prefer surgical slices over rewrites.
4. You do **not** have codebase access — only this brief and screenshots. Name **surface areas** (e.g. "results layout"), not new component filenames.
5. Output: ranked backlog (P0–P2), each with user-visible outcome, surface area, what to leave alone in the same pass, risk, and manual test plan.

**Current state summary:**
- Deterministic question flow for Car/RV/Truck/Plane/Boat with audit script at 0 defects.
- Sonnet generation uses Google Places corridor prefetch + verification checklist + `verified`/`price_band` fields + post-parse name check.
- Regenerate uses `REGENERATION DIRECTIVES` and `changes_made` in JSON; UI shows `personal_touches`.
- Collaboration, security hardening, and nav consolidation recently shipped.
- Results UI stabilized: fixed compact overview + scrollable timeline (`61eb44e`); plan choices highlight only after confirmed in history.
- Deferred: prior-trip exclusion on regenerate, anchor-city POI scoring, monetization gates, live booking APIs, cinematic loader as default.

**Constraints:**
- Anthropic key stays server-only; anon must not read raw `live_trips`/`trip_collaborations`.
- Keep fallback trip data path when API fails.
- Question flow changes must pass `audit-question-flow.mjs`.

[Paste any specific concerns or metrics from today's manual testing here.]

What should we build next week, in what order, and why?

---

## Optional attachments for Fable (safe)

- Screenshots of results UI, question flow, mobile layout issues.
- Anonymized example of a **bad** generated stop (hallucinated name) vs **good** (verified).
- User feedback quotes (no PII).
- Playwright failure screenshots (no env in logs).

---

## Repo map (for implementer reference — not for pasting wholesale)

| Area | Primary paths |
|------|----------------|
| Question flow | `src/lib/tripFlow.js`, `scripts/audit-question-flow.mjs` |
| Plan generation | `server/routes/plan-trip.js`, `server/lib/tripResponseNormalize.js` |
| Places | `src/lib/placesContext.js`, `src/lib/placesFilters.js`, `src/lib/placesSearch.js` |
| Regenerate | `src/lib/planSnapshotDiff.js`, `src/lib/tripConstraintsSummary.js` |
| Results UI | `src/components/results/TripResultsPanel.jsx`, `TripOverviewHero.jsx`, `JourneyTimeline.jsx`, `TripAlertsSection.jsx` |
| Plan choices / prefill | `src/components/QuestionChoices.jsx`, `src/lib/generationContext.js` |
| Collaboration | `server/routes/collaboration.js`, `CollaborationPanel.jsx`, `/collab/:token` |
| Security | `server/lib/apiSecurity.js`, `vercel.json`, `016_security_rls.sql` |
| Credits / tiers | `server/lib/tripCredits.js`, `src/lib/tiers.js` |
