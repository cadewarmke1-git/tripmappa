# TripMappa

AI-powered trip planning with real map routing, trucker/RV/family support, and a conversational 5-question flow.

**Live:** [tripmappa.com](https://tripmappa.com)

## Quick start

```bash
npm install
npm run dev
```

Set `VITE_GOOGLE_MAPS_KEY` in `.env` for local map loading. Trip generation uses the Vercel serverless route `/api/plan-trip` (requires `ANTHROPIC_KEY` on the server).

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
