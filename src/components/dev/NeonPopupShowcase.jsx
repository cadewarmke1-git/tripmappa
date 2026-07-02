import NeonSignPopup from "../signs/NeonSignPopup.jsx";

const DEMO = [
  { name: "Flo's V8 Café", category: "food" },
  { name: "Filmore's Organic Fuel Emporium", category: "fuel" },
  { name: "Cozy Cone Motel", category: "lodging" },
  { name: "Ramone's House of Body Art", category: "general" },
];

export default function NeonPopupShowcase({ mode = "night" }) {
  return (
    <div className={`neon-popup-showcase app-wrap ${mode}`}>
      <header className="neon-popup-showcase-header">
        <h1>Route 66 Neon Map Popups</h1>
      </header>
      <div className="neon-popup-showcase-grid">
        <section className="neon-popup-showcase-col">
          <h2>Day</h2>
          <div className="neon-popup-showcase-stack">
            {DEMO.map(b => (
              <NeonSignPopup
                key={`day-${b.category}`}
                business={b}
                mode="day"
                websiteUrl="https://example.com"
                menuUrl={b.category === "food" ? "https://example.com/menu" : null}
                bookUrl={b.category === "lodging" ? "https://example.com/book" : null}
                rating={4.6}
                verified
              />
            ))}
          </div>
        </section>
        <section className="neon-popup-showcase-col">
          <h2>Night</h2>
          <div className="neon-popup-showcase-stack">
            {DEMO.map(b => (
              <NeonSignPopup
                key={`night-${b.category}`}
                business={b}
                mode="night"
                websiteUrl="https://example.com"
                menuUrl={b.category === "food" ? "https://example.com/menu" : null}
                bookUrl={b.category === "lodging" ? "https://example.com/book" : null}
                rating={4.6}
                verified
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
