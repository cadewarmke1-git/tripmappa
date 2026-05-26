# TripMappa

AI-powered trip planning with real map routing, trucker/RV/family support, and a conversational 5-question flow.

**Live:** [tripmappa.com](https://tripmappa.com)

## Quick start

```bash
npm install
npm run dev
```

Set env vars in `.env.local` (see `.env.example`). Trip generation uses the Vercel serverless route `/api/plan-trip` (requires `ANTHROPIC_KEY` on the server).

### Supabase Auth (Phase 6)

Add to `.env.local` locally and to Vercel project settings (never commit secrets):

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend (`import.meta.env`) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend (`import.meta.env`) | Supabase anon/public key |
| `SUPABASE_URL` | Serverless (`process.env`) | Same Supabase project URL for admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverless (`process.env`) | Admin DB access in `api/` routes only |

Do not use `NEXT_PUBLIC_*`, hardcoded keys, or `VITE_`-prefixed secrets on the server. The browser client lives in `src/lib/supabaseClient.js`; server admin access uses `api/lib/supabaseAdmin.js`.

Run the SQL in `supabase/migrations/001_trips.sql` in the Supabase SQL Editor to create the `trips` table and RLS policies.

In Supabase **Authentication → URL Configuration**, add redirect URLs:

- `http://localhost:5173/` (local dev)
- `https://tripmappa.com/` (production)

Enable providers under **Authentication → Providers** (Google, Facebook, Apple as needed).

## Project structure

```
src/App.jsx          Orchestrator (~710 lines)
src/lib/             Business logic
src/components/      UI components
src/styles/          CSS (tripmappa.css + tripmappa-themes.css)
api/plan-trip.js     Trip generation (Anthropic, server-side only)
```

## Roadmap & conventions

See **[ROADMAP.md](./ROADMAP.md)** for phase status, upcoming features, money model, and required coding conventions.

**Phases 1–2 complete.** Currently polishing before **Phase 3** (Lodging & Hotel APIs).

## Stack

React 19 · Vite 8 · `@react-google-maps/api` · Vercel Analytics · Vercel serverless
