import PrivacyPolicy from "../pages/PrivacyPolicy.jsx";
import TermsOfService from "../pages/TermsOfService.jsx";
import AuthCallbackPage from "../pages/AuthCallbackPage.jsx";

/** Returns the page component for a pathname, or null for the main app. */
export function resolveAppRoute(pathname = window.location.pathname) {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/privacy") return PrivacyPolicy;
  if (path === "/terms") return TermsOfService;
  if (path === "/auth/callback") return AuthCallbackPage;
  return null;
}
