import { lazy, Suspense } from "react";

const EmailModal = lazy(() => import("./EmailModal.jsx"));
const SignInModal = lazy(() => import("./auth/SignInModal.jsx"));
const PhoneModal = lazy(() => import("./auth/PhoneModal.jsx"));
const OAuthComingSoonModal = lazy(() => import("./auth/OAuthComingSoonModal.jsx"));
const UpgradeModal = lazy(() => import("./UpgradeModal.jsx"));
const HomeAddressModal = lazy(() => import("./HomeAddressModal.jsx"));
const ReportIssueModal = lazy(() => import("./ReportIssueModal.jsx"));
const UserPreferencesPage = lazy(() => import("./UserPreferencesPage.jsx"));
const FounderWelcomeOverlay = lazy(() => import("./FounderWelcomeOverlay.jsx"));
const GenerationStreamOverlay = lazy(() => import("./GenerationStreamOverlay.jsx"));

function ModalFallback() {
  return null;
}

function withLazy(Comp) {
  return function LazyWrapper(props) {
    return (
      <Suspense fallback={<ModalFallback />}>
        <Comp {...props} />
      </Suspense>
    );
  };
}

export const LazyEmailModal = withLazy(EmailModal);
export const LazySignInModal = withLazy(SignInModal);
export const LazyPhoneModal = withLazy(PhoneModal);
export const LazyOAuthComingSoonModal = withLazy(OAuthComingSoonModal);
export const LazyUpgradeModal = withLazy(UpgradeModal);
export const LazyHomeAddressModal = withLazy(HomeAddressModal);
export const LazyReportIssueModal = withLazy(ReportIssueModal);
export const LazyUserPreferencesPage = withLazy(UserPreferencesPage);
export const LazyFounderWelcomeOverlay = withLazy(FounderWelcomeOverlay);
export const LazyGenerationStreamOverlay = withLazy(GenerationStreamOverlay);
