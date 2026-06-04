import PrivacyPolicy from "../pages/PrivacyPolicy.jsx";
import TermsOfService from "../pages/TermsOfService.jsx";

/** Returns the page component for a pathname, or null for the main app. */
export function resolveAppRoute(pathname = window.location.pathname) {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/privacy") return PrivacyPolicy;
  if (path === "/terms") return TermsOfService;
  return null;
}
