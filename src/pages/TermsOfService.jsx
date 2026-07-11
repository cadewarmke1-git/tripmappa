import { useTheme } from "../context/ThemeContext.jsx";
import BrandWordmark from "../components/BrandWordmark.jsx";

const DOCUMENT = {
  title: "Terms of Service",
  updated: "June 3, 2026",
  intro:
    "These Terms of Service govern your use of TripMappa operated by TripMappa, Inc. By using TripMappa you agree to these terms.",
  sections: [
    {
      heading: "Use of Service",
      paragraphs: [
        "TripMappa provides road trip planning services. You must be at least 13 years old to use TripMappa. You are responsible for maintaining the security of your account credentials. You agree not to use TripMappa for any unlawful purpose or in any way that could harm TripMappa or other users.",
      ],
    },
    {
      heading: "Children's Policy",
      paragraphs: [
        "TripMappa is not intended for children under 13. If you are under 13 you may not use TripMappa. If we become aware that a child under 13 has provided us with personal information we will take steps to delete that information. Parents or guardians who believe their child has provided personal information to TripMappa should contact us at tripmappa@gmail.com.",
      ],
    },
    {
      heading: "Subscriptions and Billing",
      paragraphs: [
        "TripMappa offers free and paid subscription tiers. The Wanderer tier is free with limited trip generations. The Voyager tier is available at $4.99 per month or $39.99 per year. The Trailblazer tier is available at $9.99 per month or $79.99 per year. Paid subscriptions are billed monthly or annually through Stripe. You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period. We reserve the right to change pricing with 30 days notice to existing subscribers. The Founder tier provides one year of Trailblazer access free for the first 1,000 users who sign up and complete registration, after which standard Trailblazer pricing applies. The Founder badge remains permanently on your account regardless of your subsequent subscription status.",
      ],
    },
    {
      heading: "Referral Program",
      paragraphs: [
        "TripMappa offers a referral program where existing users can invite others using a unique referral link. When a new user signs up through a valid referral link both the referrer and the new user may receive one free month of Voyager access. TripMappa reserves the right to modify or discontinue the referral program at any time. Referral rewards have no cash value and cannot be transferred or combined with other offers.",
      ],
    },
    {
      heading: "Trip generations",
      paragraphs: [
        "TripMappa uses AI to generate trip plans. Trip suggestions including stops, hotels, restaurants, and fuel stations are recommendations only. We do not guarantee the accuracy, availability, or safety of any suggested location. You are responsible for verifying information before relying on it for travel decisions. Fuel price estimates are based on regional average data sourced from the U.S. Energy Information Administration or other data providers and are approximations only. Prices may vary by location and change frequently. TripMappa may in the future provide live per-station fuel pricing where available but does not guarantee the accuracy or timeliness of any fuel price information.",
      ],
    },
    {
      heading: "Live Location Sharing",
      paragraphs: [
        "When you use live location sharing or convoy mode you consent to sharing your real-time location with people you invite. You are responsible for who you share your location with. TripMappa does not monitor or store live location data beyond what is necessary to provide the service.",
      ],
    },
    {
      heading: "Grocery Delivery",
      paragraphs: [
        "Grocery delivery is fulfilled by third party providers. TripMappa is not responsible for delivery timing, product availability, or quality. Delivery terms are subject to the third party provider's own terms and conditions. Grocery delivery is available to Trailblazer subscribers only.",
      ],
    },
    {
      heading: "EV Charging",
      paragraphs: [
        "EV charging station information is provided by the U.S. Department of Energy's National Renewable Energy Laboratory and other data sources. TripMappa does not guarantee the availability, pricing, or operational status of any charging station. Always verify charger availability before relying on it for your route.",
      ],
    },
    {
      heading: "Truck and Commercial Vehicle Routing",
      paragraphs: [
        "TripMappa provides routing recommendations for commercial vehicles including semi trucks, flatbeds, tankers, and box trucks using third party routing services. These recommendations are based on standard vehicle parameters and publicly available road restriction data. Drivers are solely responsible for verifying that their route complies with all applicable regulations, permits, and road restrictions. TripMappa is not liable for fines, damages, or incidents resulting from following suggested routes.",
      ],
    },
    {
      heading: "Intellectual Property",
      paragraphs: [
        "TripMappa and its content including the name, logo, design, and software are owned by TripMappa, Inc. You may not copy, modify, or distribute any part of TripMappa without our written permission.",
      ],
    },
    {
      heading: "Disclaimer of Warranties",
      paragraphs: [
        "TripMappa is provided as is without warranties of any kind. We do not warrant that the service will be uninterrupted, error free, or that trip suggestions will be accurate or suitable for your specific needs.",
      ],
    },
    {
      heading: "Limitation of Liability",
      paragraphs: [
        "To the maximum extent permitted by law, TripMappa, Inc. shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of TripMappa. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.",
      ],
    },
    {
      heading: "Governing Law",
      paragraphs: [
        "These terms are governed by the laws of the State of Delaware, USA. Any disputes shall be resolved in the courts of Delaware. TripMappa, Inc. operates primarily from Texas, USA.",
      ],
    },
    {
      heading: "Changes to Terms",
      paragraphs: [
        "We may update these terms from time to time. We will notify you of material changes by email or by posting a notice on tripmappa.com. Continued use of TripMappa after changes constitutes acceptance of the updated terms.",
      ],
    },
    {
      heading: "Contact Us",
      paragraphs: ["TripMappa, Inc.", "Texas, USA", "tripmappa@gmail.com"],
    },
  ],
};

export default function TermsOfService() {
  const { theme } = useTheme();

  return (
    <div className={`app-wrap legal-page ${theme}`}>
      <header className="legal-page-header">
        <a href="/" className="legal-page-home" aria-label="TripMappa home">
          <BrandWordmark />
        </a>
        <nav className="legal-page-nav" aria-label="Legal">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms" aria-current="page">Terms of Service</a>
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
              {section.paragraphs.map(text => (
                <p key={text} className="legal-page-body">{text}</p>
              ))}
            </section>
          ))}
        </article>
        <p className="legal-page-see-also">
          See also <a href="/privacy">Privacy Policy</a>
        </p>
      </main>
    </div>
  );
}
