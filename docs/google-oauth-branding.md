# Google OAuth consent screen (TripMappa branding)

The consent screen app name and domain are configured in **Google Cloud Console**, not in application code. Until these are set, Google may show your Supabase project hostname instead of TripMappa.

## Steps

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select the project used for TripMappa Google sign-in.
2. **APIs & Services** → **OAuth consent screen**.
3. Set **App name** to `TripMappa`.
4. Under **App domain**, add:
   - Application home page: `https://tripmappa.com`
   - Privacy policy: `https://tripmappa.com/privacy`
   - Terms of service: `https://tripmappa.com/terms`
5. **Authorized domains**: add `tripmappa.com` (and `www.tripmappa.com` if you use it).
6. Save and submit for verification if the app is in Production mode.

## Supabase Auth (redirect URLs)

In the Supabase dashboard → **Authentication** → **URL configuration**:

- **Site URL**: `https://tripmappa.com`
- **Redirect URLs**: include your production and local URLs, e.g. `https://tripmappa.com/**` and `http://localhost:5173/**`

Google OAuth client **Authorized redirect URIs** must include Supabase’s callback, e.g. `https://<project-ref>.supabase.co/auth/v1/callback`. The user-facing name on the consent screen still comes from the OAuth consent screen settings above.
