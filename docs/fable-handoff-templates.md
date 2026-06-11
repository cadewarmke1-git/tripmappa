# TripMappa — Fable ↔ Cursor paste templates

One screen, one problem. Fable has **no repo access** — only screenshots + what you paste. Full context: `docs/fable-review-brief.md`.

---

## 1. New Fable session (paste to start)

```
You are reviewing TripMappa (road-trip planner). You do NOT have source code — only this message and screenshots I attach.

Your job:
1. Rank improvements P0–P2 (one problem per item).
2. For each item: user-visible outcome, surface area (e.g. "results layout" — NOT invented component names), what to leave alone in the same pass, risk, manual test plan.
3. Flag anything that weakens security or increases hallucination risk.
4. Prefer surgical slices over rewrites.

Current state (post-61eb44e):
- Results: fixed compact overview + scrollable timeline (not a full redesign).
- Plan choices: highlight only after confirmed in question history (prefill should not look selected).
- Generation: Sonnet server-side, Places corridor prefetch, verified/price_band, personal_touches in UI.
- Shipped recently: collaboration, security hardening, nav in avatar menu.
- Deferred: prior-trip exclusion on regenerate, anchor-city POI scoring, cinematic loader as default, map DnD sync.

Constraints: Anthropic key server-only; question flow must stay at 0 audit defects; no anon broad DB reads.

[Screenshot + what feels wrong]
[Optional: specific vehicle, device, step name]

What should we fix first, in what order, and why?
```

---

## 2. Fable → Cursor (paste after Fable recommends something)

```
Implement ONE item from Fable review — surgical diff only.

**User-visible outcome:** [one sentence]
**Problem screenshot:** [attached or described]

**In scope (edit only these):**
- [file 1, e.g. src/components/results/TripResultsPanel.jsx]
- [file 2]
- [optional file 3]

**Out of scope (do not touch):**
- PlanPanel / QuestionChoices / plan-flow CSS (unless listed in scope)
- GenerationCinematicLoader / Three.js
- useItinerarySync / map drag-and-drop
- App.jsx (unless listed in scope)
- collaboration.js, apiSecurity.js, tripCredits.js
- New components, new npm deps, new CSS files

**Budget:** ≤3 files, ≤200 lines net unless I say otherwise.
**Approach:** Extend existing components; do not create parallel replacements.
**Verify:** npm test && npm run build. No commit unless I ask.

**Fable recommendation (outcomes only — not a file-level spec):**
[paste diagnosis + desired UX; strip any invented component names]
```

### Quick file picker (common tasks)

| Problem | Start here |
|---------|------------|
| Results scroll / layout | `TripResultsPanel.jsx`, `JourneyTimeline.jsx`, `tripmappa.css` |
| Overview / summary header | `TripOverviewHero.jsx`, `TripResultsPanel.jsx` |
| Stop cards / day sections | `ResultsDaySection.jsx`, `JourneyTimeline.jsx` |
| Plan choice pre-selected | `QuestionChoices.jsx`, `generationContext.js` |
| Generation quality / names | `server/routes/plan-trip.js`, `tripResponseNormalize.js` |
| Personal touches display | `PersonalTouchesStrip.jsx` (no duplicate section) |
| Loader only | `RouteDrawingLoader` — not Three.js cinematic |

---

## 3. Cursor → Fable (paste after implementation)

```
TripMappa implementation update — you still have no code access; use this + screenshots.

**What we shipped:** [1–2 sentences]
**Commit:** [hash or "local only"]
**Files touched:** [list every file — you cannot see the repo]
**Net change:** [rough line count if known]

**Screenshots:** [before/after; note mobile vs desktop]

**Still broken / open:**
- [item]

**Deferred on purpose:**
- [item + why]

Question for Fable: [ONE specific question — e.g. "Is the day-2 fuel card readable on mobile night theme?"]
```

---

## 4. Budget reminder (append to any Cursor task)

```
Budget: ≤3 files, ≤200 lines net. No new components or npm deps. npm test && npm run build. No commit unless I ask.
```

---

## 5. Fable output format (ask Fable to use this)

```
For each recommendation:
- P0/P1/P2
- User-visible outcome (1 sentence)
- Surface area (module/theme, not filenames)
- Leave alone in same pass
- Risk (security / hallucination / regression)
- Manual test (3–5 steps, vehicle + device)
```
