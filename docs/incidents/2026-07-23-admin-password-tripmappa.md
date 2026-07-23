# Incident: ADMIN_PASSWORD rejection for tripmappa@gmail.com

**Status:** Closed — not reproduced (2026-07-23)  
**Severity:** P2 (auth / admin ops)  
**Reporter context:** Headed verification wrongly used `ADMIN_EMAIL` (`cadewarmke@gmail.com`) instead of Playwright admin `tripmappa@gmail.com`.

## Summary

Suspected that `ADMIN_PASSWORD` from `.env.local` was rejected for the real admin login (`tripmappa@gmail.com`). Repro against that account **succeeded**. The earlier “Invalid login credentials” was against the wrong email (`cadewarmke@gmail.com` via `ADMIN_EMAIL` fallback in `scripts/export-playwright-auth.mjs`), not an app auth bug for the Playwright admin user.

## Expected

Email/password sign-in for `tripmappa@gmail.com` with `PLAYWRIGHT_ADMIN_PASSWORD` or `ADMIN_PASSWORD` from `.env.local` opens a signed-in session (profile menu shows Sign out).

## Actual (suspected)

Sign-in modal showed “Invalid login credentials.”

## Repro steps (for future regressions)

1. Start local app: `npm run dev -- --host 127.0.0.1 --port 5173`
2. Open `http://127.0.0.1:5173/?skyHour=14`
3. Profile menu → **Sign in**
4. Email: `tripmappa@gmail.com`
5. Password: value of `PLAYWRIGHT_ADMIN_PASSWORD` if set, else `ADMIN_PASSWORD` from `.env.local`
6. Submit **Sign In →**
7. Confirm profile menu shows **Sign out**

Alternate: `node scripts/export-playwright-auth.mjs` with `PLAYWRIGHT_ADMIN_EMAIL=tripmappa@gmail.com` (do **not** fall back to founder `ADMIN_EMAIL`).

## Verification (2026-07-23)

| Check | Result |
|---|---|
| Email | `tripmappa@gmail.com` |
| Password env used | `ADMIN_PASSWORD` (no `PLAYWRIGHT_ADMIN_PASSWORD` set) |
| Outcome | `signedIn: true`, `authError: null` |
| Wrong-email control | `cadewarmke@gmail.com` + same password → Invalid login credentials |

## Root cause of the false alarm

`scripts/export-playwright-auth.mjs` briefly preferred `ADMIN_EMAIL` (founder / app admin bypass address) over the default Playwright admin `tripmappa@gmail.com`. Those are different Supabase users.

## Follow-ups

- Prefer `PLAYWRIGHT_ADMIN_EMAIL` → default `tripmappa@gmail.com`; do not use `ADMIN_EMAIL` for Playwright password sign-in.
- Keep `ADMIN_EMAIL` for server-side limit bypass only (`server/lib/adminAccess.js`).
