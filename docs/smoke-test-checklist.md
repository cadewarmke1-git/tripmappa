# TripMappa pre-deploy smoke test checklist

Run these manual checks before every production deploy.

## 1. Back-to-back trip generation context

1. Sign in as a logged-in user.
2. Generate a trip and wait for it to finish (background save may still be running).
3. Reload the page.
4. Generate a second trip.
5. Open the browser console and confirm the first saved trip appears in generation hints / recent-trip context logs.

## 2. Learned route preference prefill

1. Sign in and generate three consecutive trips.
2. On each trip, select **Pet friendly** in route preferences.
3. Start a fourth trip.
4. Confirm route preferences pre-fill with **Pet friendly**.

## 3. Sky-cycle theming

1. On the hero view, toggle between day and night sky cycle.
2. Confirm these surfaces follow the active theme (background, text, borders, accents):
   - Auth modal
   - Autocomplete dropdown
   - Profile avatar dropdown (hero and in-app nav)
3. No hardcoded dark/light panels should remain out of sync with the sky cycle.

## 4. Preferences panel on small mobile

1. Open the User Preferences panel on a **375px** or **390px** wide viewport (iOS/Android simulator or responsive mode).
2. Scroll through sections.
3. Confirm the sticky save bar is fully visible above the home indicator / system navigation bar (not clipped).

## 5. Guest conversion preference write-back

1. As a guest, generate a trip (note answers such as vehicle, dietary, or route prefs).
2. Sign up for a new account from the guest flow.
3. After conversion, open **Profile** or **User Preferences**.
4. Confirm the preference profile is populated with the guest trip’s answers (not blank defaults).
