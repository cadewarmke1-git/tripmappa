# TripMappa — Claude Context

## Project
Road trip planning web app. tripmappa.com.
Founder: Cade Warmke (cadewarmke@gmail.com).
Status: Pre-launch, Phase 11 polish.

## Stack
- Frontend: React + Vite
- Backend: Vercel serverless functions
- Database/Auth: Supabase
- AI Generation: Anthropic Claude Sonnet (claude-sonnet-4-6)
- Maps: Google Maps JavaScript API + Places API
- Routing: HERE Maps (truck/RV vehicle-specific routing)
- Payments: Stripe
- Email: Resend
- SMS: Twilio
- Fuel/EV: NREL API
- Weather: Weather.gov

## Tiers
- Wanderer: free, 3 lifetime trips
- Voyager: $4.99/mo or $39.99/yr, 20 trips/month
- Trailblazer: $9.99/mo or $79.99/yr, 100 trips/month
- Founder: first 1,000 users, 1 year free Trailblazer + gold star badge

## Design System
- Gold: #FFD28C (primary accent)
- Orange: #FF8C42 (CTAs, buttons)
- Night: #0D0A1A (dark mode base)
- Day: #FDF3E0 (light mode base)
- Category colors: Food #ff5fa8, Fuel #3dd9d0, Lodging #FFD28C, General #5a9e96
- Fonts: Fraunces for all UI, Limelight for neon sign components only, Inter for body/labels
- No purple anywhere
- No glass morphism anywhere
- No Tailwind — use existing CSS token system
- No AI language in user-facing copy

## Architecture Rules
- One fix per prompt for shared files
- Verify on tripmappa.com after every deploy
- Never break generation logic or question flow logic
- Admin bypass: cadewarmke@gmail.com (ADMIN_EMAIL env var)
- Question flow audit: node scripts/audit-question-flow.mjs must pass 315/0

## What's Built
- Full question flow: vehicle, fuel, travelers, stops, scenic, trip details
- Trip generation via Claude Sonnet with Google Places enrichment
- Results page with unified stop cards (RoadTripStopCard)
- Vintage neon sign map popups (VintageNeonSignCard) — DO NOT MODIFY internals
- Gold car marker following live GPS in navigation mode
- Server-backed share links with UUID, 90-day TTL
- Supabase auth with email signup gate before generation
- Stripe billing with tier enforcement server-side
- HERE Maps truck/RV routing
- Sky cycle tied to real local time driving day/night theme
- shadcn/ui installed at src/components/ui/
- e2e tests: 23/23 passing (npm run test:e2e)
- Demo readiness test: e2e/demo-readiness.spec.js

## What's Off Limits
- VintageNeonSignCard.jsx internals — polish mount only
- Generation logic — no changes without explicit instruction
- Question flow order — no reordering without explicit instruction
- Supabase migrations — always confirm before running
- Stripe logic — never modify checkout or webhook handlers

## Current Bugs / In Progress
- Map marker popup click fix deployed (709425d)
- Mobile input blocking fixed
- e2e demo readiness test at 4/5 (marker click selector issue only)

## Post Launch Roadmap
- Booking.com affiliate integration
- Apple App Store via Capacitor
- In-destination explore feature with preference memory
- Sentry error monitoring
- Live fuel prices
- Rewards/leaderboard system

## Visual Verification Protocol
After implementing any UI change, Cursor must:
1. Run `npm run build` and confirm clean
2. Start the local preview server (`npm run preview`, port 4173) if not already running — the app must be fully running, not a stub page or isolated component render
3. Take Playwright screenshots at **1280×800 desktop** and **375×812 mobile** of every screen that was modified, captured against the live preview server
4. **Map-related fixes:** screenshots must show the actual Google Maps instance rendered with a real route loaded — not a placeholder, mock tile, or empty map panel
5. **Question flow fixes:** screenshots must show the actual plan flow running with a real route already set (e.g. origin + destination entered), stepping through **at least 3 question steps** in sequence
6. **Describe what you see** in each screenshot in plain language — report what is actually visible, not what the code says should be there
7. If a screenshot does not match the expected result, fix the issue and re-screenshot before reporting done
8. Never report a UI task as complete without screenshot evidence showing the change looks correct
9. Include the screenshots in the report back

A fix is not complete until the screenshot confirms it visually. Code inspection alone is never sufficient verification — including when confirming that earlier work from the same session is actually correct in the running app.
