import { useTheme } from "../context/ThemeContext.jsx";
import BrandWordmark from "../components/BrandWordmark.jsx";

const DOCUMENT = {
  title: "Privacy Policy",
  updated: "June 3, 2026",
  intro:
    "TripMappa, Inc. (\"TripMappa,\" \"we,\" \"us,\" or \"our\") operates tripmappa.com and the TripMappa mobile application. This Privacy Policy explains how we collect, use, and protect your information when you use our services.",
  sections: [
    {
      heading: "Information We Collect",
      paragraphs: [
        "We collect information you provide directly to us, including your name, email address, phone number, home address, and emergency contact when you create an account. We collect trip data including your origin, destination, stops, vehicle type, and travel preferences when you generate trips. We collect payment information processed securely through Stripe — we never store your full card number. We collect location data when you use live location sharing or convoy mode, only while those features are active. We collect usage data including how you interact with TripMappa to improve our services. We collect referral information including referral codes used during signup to apply rewards to eligible accounts.",
      ],
    },
    {
      heading: "How We Use Your Information",
      paragraphs: [
        "We use your information to provide and improve our services, generate personalized trip plans, process payments, send transactional emails including welcome messages and subscription notifications, enable live location sharing when you choose to activate it, apply referral rewards to your account, and communicate with you about your account.",
      ],
    },
    {
      heading: "Information We Share",
      paragraphs: [
        "We do not sell your personal information. We share information with service providers who help us operate TripMappa including Supabase for database and authentication, Stripe for payment processing, Resend for email delivery, Google for maps and places data, Anthropic for AI trip generation, HERE Maps for routing, Twilio for SMS verification, NREL for EV charging station data, and the U.S. Energy Information Administration for regional fuel price data. We also work with third party grocery delivery providers to fulfill grocery delivery orders placed through TripMappa. Each provider is bound by their own privacy policies and data protection agreements.",
      ],
    },
    {
      heading: "Data Retention",
      paragraphs: [
        "We retain your account information for as long as your account is active. You may delete your account at any time by contacting us at tripmappa@gmail.com. Trip data is retained to provide you with trip history and improve recommendations.",
      ],
    },
    {
      heading: "Your Rights",
      paragraphs: [
        "You have the right to access, correct, or delete your personal information. California residents have additional rights under CCPA including the right to know what personal information we collect and the right to opt out of sale of personal information — we do not sell personal information. To exercise your rights contact us at tripmappa@gmail.com.",
      ],
    },
    {
      heading: "Children's Privacy",
      paragraphs: [
        "TripMappa is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information we will take steps to delete that information. Parents or guardians who believe their child has provided personal information to TripMappa should contact us at tripmappa@gmail.com.",
      ],
    },
    {
      heading: "Security",
      paragraphs: [
        "We use industry standard security measures to protect your information including encrypted connections, secure authentication, and access controls. No system is completely secure and we cannot guarantee absolute security.",
      ],
    },
    {
      heading: "Changes to This Policy",
      paragraphs: [
        "We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice on tripmappa.com. Continued use of TripMappa after changes constitutes acceptance of the updated policy.",
      ],
    },
    {
      heading: "Contact Us",
      paragraphs: ["TripMappa, Inc.", "Texas, USA", "tripmappa@gmail.com"],
    },
  ],
};

export default function PrivacyPolicy() {
  const { theme } = useTheme();

  return (
    <div className={`app-wrap legal-page ${theme}`}>
      <header className="legal-page-header">
        <a href="/" className="legal-page-home" aria-label="TripMappa home">
          <BrandWordmark />
        </a>
        <nav className="legal-page-nav" aria-label="Legal">
          <a href="/privacy" aria-current="page">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </nav>
      </header>

      <main className="legal-page-main">
        <article className="legal-page-article">
          <p className="legal-page-updated">Last Updated: {DOCUMENT.updated}</p>
          <h1 className="legal-page-title">{DOCUMENT.title}</h1>
          <p className="legal-page-intro">{DOCUMENT.intro}</p>
          {DOCUMENT.sections.map(section => (
            <section key={section.heading} className="legal-page-section">
              <h2 className="legal-page-section-title">{section.heading}</h2>
              {section.paragraphs.map((text, i) => (
                <p key={i} className="legal-page-body">{text}</p>
              ))}
            </section>
          ))}
        </article>
        <p className="legal-page-see-also">
          See also <a href="/terms">Terms of Service</a>
        </p>
      </main>
    </div>
  );
}
