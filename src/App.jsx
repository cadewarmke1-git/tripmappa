import { useState } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
  :root {
    --ink: #0a0c10; --surface: #f4f1ec; --card: #ffffff;
    --accent: #e05c2a; --accent2: #2a7ae0; --accent3: #2abf6e;
    --muted: #8a8a8a; --border: #e2ddd7; --nav-h: 64px; --r: 14px;
    --shadow: 0 2px 16px rgba(0,0,0,0.08);
    --shadow-lg: 0 8px 40px rgba(0,0,0,0.14);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: var(--surface); color: var(--ink); min-height: 100vh; font-size: 15px; }
  h1,h2,h3,h4,h5 { font-family: 'Syne', sans-serif; }
  .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: var(--nav-h); background: var(--ink); display: flex; align-items: center; justify-content: space-between; padding: 0 28px; gap: 16px; }
  .nav-logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; display: flex; align-items: center; gap: 8px; }
  .nav-logo span { color: var(--accent); }
  .nav-tabs { display: flex; gap: 4px; }
  .nav-tab { background: none; border: none; cursor: pointer; color: #999; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; padding: 7px 16px; border-radius: 8px; transition: all 0.18s; }
  .nav-tab:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .nav-tab.active { background: var(--accent); color: #fff; }
  .nav-actions { display: flex; gap: 10px; }
  .btn-icon { background: rgba(255,255,255,0.08); border: none; cursor: pointer; color: #fff; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: background 0.18s; }
  .btn-icon:hover { background: rgba(255,255,255,0.16); }
  .app { padding-top: var(--nav-h); display: flex; height: 100vh; }
  .sidebar { width: 380px; min-width: 340px; max-width: 420px; height: calc(100vh - var(--nav-h)); overflow-y: auto; background: var(--card); border-right: 1.5px solid var(--border); display: flex; flex-direction: column; }
  .sidebar::-webkit-scrollbar { width: 5px; }
  .sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .map-area { flex: 1; position: relative; overflow: hidden; }
  .map-placeholder { width: 100%; height: 100%; background: linear-gradient(160deg, #d4e4ef 0%, #c8dbe8 40%, #b8d0de 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; }
  .map-placeholder-text { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: rgba(0,0,0,0.3); }
  .map-placeholder-sub { font-size: 13px; color: rgba(0,0,0,0.2); }
  .sec-head { padding: 20px 20px 0; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
  .input-group { padding: 14px 20px 0; }
  .input-label { font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .input-field { width: 100%; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; background: var(--surface); color: var(--ink); outline: none; transition: border-color 0.18s; }
  .input-field:focus { border-color: var(--accent2); background: #fff; }
  .input-row { display: flex; gap: 10px; padding: 14px 20px 0; }
  .input-row .input-group { padding: 0; flex: 1; }
  .route-info { display: flex; align-items: center; background: var(--ink); color: #fff; border-radius: var(--r); margin: 14px 20px; overflow: hidden; }
  .route-info-cell { flex: 1; padding: 12px 0; text-align: center; border-right: 1px solid rgba(255,255,255,0.1); }
  .route-info-cell:last-child { border-right: none; }
  .ric-val { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; }
  .ric-label { font-size: 10px; color: #aaa; margin-top: 1px; letter-spacing: 0.5px; }
  .prefs-block { padding: 14px 20px 0; }
  .prefs-label { font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .check-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .check-pill { display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--border); border-radius: 8px; padding: 5px 11px; cursor: pointer; font-size: 13px; transition: all 0.16s; background: var(--surface); user-select: none; }
  .check-pill input { display: none; }
  .check-pill.checked { background: #f0f7ff; border-color: var(--accent2); color: var(--accent2); font-weight: 600; }
  .star-row { display: flex; gap: 6px; align-items: center; margin-bottom: 12px; }
  .star-btn { background: none; border: 1.5px solid var(--border); border-radius: 7px; padding: 4px 10px; cursor: pointer; font-size: 14px; transition: all 0.14s; }
  .star-btn.on { background: #fff8e1; border-color: #f5a623; }
  .btn-generate { margin: 16px 20px 20px; width: calc(100% - 40px); padding: 14px; border: none; cursor: pointer; background: linear-gradient(135deg, var(--accent) 0%, #f07840 100%); color: #fff; border-radius: var(--r); font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.2px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.16s, box-shadow 0.16s; box-shadow: 0 4px 18px rgba(224,92,42,0.35); }
  .btn-generate:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(224,92,42,0.45); }
  .btn-generate:active { transform: translateY(0); }
  .btn-generate:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .results-scroll { flex: 1; overflow-y: auto; padding: 20px; }
  .results-scroll::-webkit-scrollbar { width: 5px; }
  .results-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: var(--muted); line-height: 1.5; }
  .stop-card { background: var(--card); border: 1.5px solid var(--border); border-radius: var(--r); margin-bottom: 14px; overflow: hidden; transition: box-shadow 0.18s; animation: slideUp 0.3s ease both; }
  .stop-card:hover { box-shadow: var(--shadow-lg); }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .stop-card-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1.5px solid var(--border); background: var(--surface); }
  .stop-num { width: 28px; height: 28px; border-radius: 50%; background: var(--ink); color: #fff; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .stop-card-body { padding: 14px 16px; }
  .stop-name { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; }
  .stop-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .stop-actions { display: flex; gap: 8px; margin-top: 12px; }
  .btn-sm { flex: 1; padding: 9px 0; border-radius: 9px; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.16s; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: #c94e20; }
  .btn-outline-sm { background: var(--surface); color: var(--ink); border: 1.5px solid var(--border); }
  .btn-outline-sm:hover { background: var(--border); }
  .btn-blue { background: var(--accent2); color: #fff; }
  .btn-blue:hover { background: #1e6bc8; }
  .btn-green { background: var(--accent3); color: #fff; }
  .btn-green:hover { background: #23a85e; }
  .sub-section { margin-top: 12px; }
  .sub-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 8px; }
  .sub-card { display: flex; align-items: center; gap: 10px; border: 1.5px solid var(--border); border-radius: 9px; padding: 10px 12px; margin-bottom: 7px; background: var(--surface); cursor: pointer; transition: border-color 0.16s; }
  .sub-card:hover { border-color: var(--accent2); }
  .sub-card-icon { font-size: 22px; }
  .sub-card-info { flex: 1; }
  .sub-card-name { font-size: 14px; font-weight: 500; }
  .sub-card-meta { font-size: 12px; color: var(--muted); margin-top: 1px; }
  .sub-card-price { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; }
  .fuel-card { border: 1.5px dashed var(--border); border-radius: var(--r); padding: 12px 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; background: var(--surface); }
  .fuel-icon { font-size: 26px; }
  .fuel-info { flex: 1; }
  .fuel-name { font-size: 14px; font-weight: 500; }
  .fuel-meta { font-size: 12px; color: var(--muted); }
  .fuel-action { background: var(--ink); color: #fff; border: none; border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .share-intro { font-size: 14px; color: var(--muted); margin-bottom: 18px; line-height: 1.5; }
  .person-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; margin-bottom: 8px; background: var(--surface); border: 1.5px solid var(--border); }
  .avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--ink); color: #fff; font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .person-info { flex: 1; }
  .person-name { font-size: 14px; font-weight: 500; }
  .person-status { font-size: 12px; color: var(--muted); }
  .status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; }
  .status-dot.live { background: var(--accent3); }
  .status-dot.pending { background: #f5a623; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal { background: var(--card); border-radius: 18px; padding: 28px; max-width: 400px; width: 100%; box-shadow: var(--shadow-lg); }
  .modal-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; margin-bottom: 6px; }
  .modal-sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }
  .grocery-list { list-style: none; margin-bottom: 14px; }
  .grocery-item { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
  .grocery-item:last-child { border-bottom: none; }
  .grocery-input-row { display: flex; gap: 8px; margin-bottom: 16px; }
  .grocery-input { flex: 1; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; }
  .grocery-input:focus { border-color: var(--accent2); }
  .modal-actions { display: flex; gap: 10px; }
  .btn-modal { flex: 1; padding: 12px; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; }
  .btn-modal-primary { background: var(--accent3); color: #fff; }
  .btn-modal-outline { background: var(--surface); color: var(--ink); border: 1.5px solid var(--border); }
  .toast { position: fixed; bottom: 24px; right: 24px; z-index: 300; background: var(--ink); color: #fff; padding: 13px 20px; border-radius: 12px; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; box-shadow: var(--shadow-lg); animation: slideRight 0.3s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes slideRight { from { opacity:0; transform: translateX(40px); } to { opacity:1; transform: translateX(0); } }
  .spinner { width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .section-divider { border: none; border-top: 1.5px solid var(--border); margin: 0; }
`;

const STOP_TEMPLATES = [
  {
    city: "Amarillo, TX", state: "TX", distance: "263 mi", eta: "3h 45m",
    hotels: [
      { name: "Amarillo Grand Hotel", stars: 4, price: "$129", icon: "🏨", petFriendly: true },
      { name: "Big Texan Inn", stars: 3, price: "$89", icon: "🏨", petFriendly: false },
    ],
    restaurants: [
      { name: "The Big Texan Steak Ranch", cuisine: "Steakhouse", rating: "4.6 ⭐", time: "7pm" },
      { name: "Crush Wine Bar", cuisine: "American", rating: "4.4 ⭐", time: "8pm" },
    ],
  },
  {
    city: "Albuquerque, NM", state: "NM", distance: "289 mi", eta: "4h 10m",
    hotels: [
      { name: "Hotel Albuquerque", stars: 4, price: "$149", icon: "🏨", petFriendly: true },
      { name: "Nativo Lodge", stars: 3, price: "$99", icon: "🏨", petFriendly: false },
    ],
    restaurants: [
      { name: "Sadie's of New Mexico", cuisine: "New Mexican", rating: "4.5 ⭐", time: "7pm" },
      { name: "Casa de Benavidez", cuisine: "Mexican", rating: "4.3 ⭐", time: "8pm" },
    ],
  },
  {
    city: "Flagstaff, AZ", state: "AZ", distance: "321 mi", eta: "4h 45m",
    hotels: [
      { name: "Little America Hotel", stars: 4, price: "$159", icon: "🏨", petFriendly: true },
      { name: "Drury Inn Flagstaff", stars: 3, price: "$109", icon: "🏨", petFriendly: false },
    ],
    restaurants: [
      { name: "Tinderbox Kitchen", cuisine: "American", rating: "4.7 ⭐", time: "7pm" },
      { name: "Brix Restaurant", cuisine: "Fine Dining", rating: "4.6 ⭐", time: "8pm" },
    ],
  },
];

const FUEL_STOPS = [
  { type: "ev", name: "Tesla Supercharger — Amarillo", icon: "⚡", power: "250kW", stalls: "12 stalls available" },
  { type: "ev", name: "Electrify America — Santa Rosa", icon: "⚡", power: "150kW", stalls: "4 stalls available" },
  { type: "ev", name: "ChargePoint — Albuquerque", icon: "⚡", power: "62kW", stalls: "8 stalls available" },
  { type: "gas", name: "Pilot Travel Center — Amarillo", icon: "⛽", price: "$3.42/gal", distance: "0.3 mi off route" },
  { type: "gas", name: "Love's Travel Stop — Santa Rosa", icon: "⛽", price: "$3.38/gal", distance: "On route" },
  { type: "gas", name: "Love's Travel Stop — Gallup", icon: "⛽", price: "$3.51/gal", distance: "0.1 mi off route" },
];

const TRUCK_PARKING = [
  { name: "Pilot Flying J — Amarillo", spaces: "142 spaces", type: "Truck + RV" },
  { name: "TA Travel Center — Tucumcari", spaces: "89 spaces", type: "Truck only" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("plan");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [fuelType, setFuelType] = useState("gas");
  const [starPref, setStarPref] = useState(3);
  const [stayTypes, setStayTypes] = useState({ hotel: true, rv: false, airbnb: false, campground: false });
  const [pets, setPets] = useState({ dog: false, cat: false, horse: false });
  const [amenities, setAmenities] = useState({ restaurants: true, grocery: false, evCharging: false });
  const [stops, setStops] = useState([]);
  const [fuelStops, setFuelStops] = useState([]);
  const [truckParking, setTruckParking] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [groceryInput, setGroceryInput] = useState("");
  const [groceryItems, setGroceryItems] = useState([]);

  function showToast(msg, icon = "✓") { setToast({ msg, icon }); setTimeout(() => setToast(null), 2800); }
  function toggleStay(k) { setStayTypes(s => ({ ...s, [k]: !s[k] })); }
  function togglePet(k) { setPets(s => ({ ...s, [k]: !s[k] })); }
  function toggleAmenity(k) { setAmenities(s => ({ ...s, [k]: !s[k] })); }

  async function generateTrip() {
    if (!origin || !destination) { showToast("Enter origin and destination first", "⚠️"); return; }
    setLoading(true); setActiveTab("stops");
    await new Promise(r => setTimeout(r, 1800));
    setStops(STOP_TEMPLATES.map(s => ({ ...s, hotels: s.hotels.filter(h => Math.abs(h.stars - starPref) <= 1).slice(0, 2) })));
    setFuelStops(fuelType === "ev" ? FUEL_STOPS.filter(f => f.type === "ev") : FUEL_STOPS.filter(f => f.type === "gas"));
    setTruckParking(vehicleType === "truck" ? TRUCK_PARKING : []);
    setLoading(false); setGenerated(true);
    showToast("AI trip generated! 🗺️");
  }

  function saveTrip() { showToast("Trip saved to your profile!", "💾"); }
  function addGrocery() { if (!groceryInput.trim()) return; setGroceryItems(g => [...g, groceryInput.trim()]); setGroceryInput(""); }
  function sendGroceryList() { showToast(`Grocery order sent! (${groceryItems.length} items)`, "🛒"); setModal(null); }

  const ConfigPanel = () => (
    <div>
      <div className="sec-head" style={{ paddingTop: 20 }}>Plan Your Trip</div>
      <div className="input-group">
        <div className="input-label">From</div>
        <input className="input-field" placeholder="Dallas, TX" value={origin} onChange={e => setOrigin(e.target.value)} />
      </div>
      <div className="input-group">
        <div className="input-label">To</div>
        <input className="input-field" placeholder="Los Angeles, CA" value={destination} onChange={e => setDestination(e.target.value)} />
      </div>
      {origin && destination && (
        <div className="route-info">
          <div className="route-info-cell"><div className="ric-val">1,432 mi</div><div className="ric-label">DISTANCE</div></div>
          <div className="route-info-cell"><div className="ric-val">20h 15m</div><div className="ric-label">DRIVE TIME</div></div>
          <div className="route-info-cell"><div className="ric-val" style={{ fontSize: 13 }}>3 stops</div><div className="ric-label">SUGGESTED</div></div>
        </div>
      )}
      <hr className="section-divider" style={{ margin: "16px 0 0" }} />
      <div className="input-row" style={{ paddingTop: 16 }}>
        <div className="input-group">
          <div className="input-label">Vehicle</div>
          <select className="input-field" value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
            <option value="car">🚗 Car</option>
            <option value="rv">🚐 RV / Camper</option>
            <option value="truck">🚛 Semi Truck</option>
            <option value="motorcycle">🏍 Motorcycle</option>
          </select>
        </div>
        <div className="input-group">
          <div className="input-label">Fuel</div>
          <select className="input-field" value={fuelType} onChange={e => setFuelType(e.target.value)}>
            <option value="gas">⛽ Gas</option>
            <option value="ev">⚡ Electric</option>
            <option value="diesel">🛢 Diesel</option>
            <option value="hybrid">🔋 Hybrid</option>
          </select>
        </div>
      </div>
      <hr className="section-divider" style={{ margin: "16px 0 0" }} />
      <div className="sec-head" style={{ paddingTop: 16 }}>Lodging Preferences</div>
      <div className="prefs-block">
        <div className="prefs-label">Star Rating</div>
        <div className="star-row">
          {[1,2,3,4,5].map(n => (
            <button key={n} className={"star-btn" + (n <= starPref ? " on" : "")} onClick={() => setStarPref(n)}>{"⭐".repeat(n)}</button>
          ))}
        </div>
      </div>
      <div className="prefs-block">
        <div className="prefs-label">Stay Types</div>
        <div className="check-row">
          {[["hotel","🏨 Hotel"],["rv","🚐 RV Park"],["campground","⛺ Campground"],["airbnb","🏠 Airbnb"]].map(([k,label]) => (
            <label key={k} className={"check-pill" + (stayTypes[k] ? " checked" : "")}>
              <input type="checkbox" checked={!!stayTypes[k]} onChange={() => toggleStay(k)} />{label}
            </label>
          ))}
        </div>
      </div>
      <div className="prefs-block">
        <div className="prefs-label">Traveling With Pets</div>
        <div className="check-row">
          {[["dog","🐕 Dog"],["cat","🐈 Cat"],["horse","🐴 Horse"]].map(([k,label]) => (
            <label key={k} className={"check-pill" + (pets[k] ? " checked" : "")}>
              <input type="checkbox" checked={!!pets[k]} onChange={() => togglePet(k)} />{label}
            </label>
          ))}
        </div>
      </div>
      <div className="prefs-block" style={{ paddingBottom: 4 }}>
        <div className="prefs-label">Extras</div>
        <div className="check-row">
          {[["restaurants","🍽️ Restaurants"],["grocery","🛒 Grocery Delivery"],["evCharging","⚡ EV Charging"]].map(([k,label]) => (
            <label key={k} className={"check-pill" + (amenities[k] ? " checked" : "")}>
              <input type="checkbox" checked={!!amenities[k]} onChange={() => toggleAmenity(k)} />{label}
            </label>
          ))}
        </div>
      </div>
      <button className="btn-generate" onClick={generateTrip} disabled={loading}>
        {loading ? <><div className="spinner" />&nbsp;Planning your trip…</> : <>✦ Generate AI Trip Plan</>}
      </button>
    </div>
  );

  const StopsPanel = () => (
    <div className="results-scroll">
      {!generated ? (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <div className="empty-title">No trip planned yet</div>
          <div className="empty-sub">Fill in your route and preferences,<br />then hit <strong>Generate AI Trip Plan</strong></div>
        </div>
      ) : (
        <>
          {fuelStops.length > 0 && (
            <>
              <div className="sec-head" style={{ padding: "0 0 10px" }}>{fuelType === "ev" ? "⚡ Charging Stops" : "⛽ Fuel Stops"}</div>
              {fuelStops.map((f, i) => (
                <div className="fuel-card" key={i}>
                  <div className="fuel-icon">{f.icon}</div>
                  <div className="fuel-info">
                    <div className="fuel-name">{f.name}</div>
                    <div className="fuel-meta">{f.type === "ev" ? `${f.power} · ${f.stalls}` : `${f.price} · ${f.distance}`}</div>
                  </div>
                  <button className="fuel-action" onClick={() => showToast(`Added ${f.name} to route`, "📍")}>Add</button>
                </div>
              ))}
            </>
          )}
          {truckParking.length > 0 && (
            <>
              <div className="sec-head" style={{ padding: "12px 0 10px" }}>🅿️ Truck Parking</div>
              {truckParking.map((p, i) => (
                <div className="fuel-card" key={i}>
                  <div className="fuel-icon">🚛</div>
                  <div className="fuel-info">
                    <div className="fuel-name">{p.name}</div>
                    <div className="fuel-meta">{p.spaces} · {p.type}</div>
                  </div>
                  <button className="fuel-action" onClick={() => showToast(`Parking reserved at ${p.name}`, "✅")}>Reserve</button>
                </div>
              ))}
            </>
          )}
          <div className="sec-head" style={{ padding: "12px 0 10px" }}>🛑 Overnight Stops</div>
          {stops.map((stop, i) => (
            <div className="stop-card" key={i} style={{ animationDelay: i * 0.08 + "s" }}>
              <div className="stop-card-head">
                <div className="stop-num">{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div className="stop-name">{stop.city}</div>
                  <div className="stop-meta">~{stop.distance} from previous · {stop.eta} drive</div>
                </div>
              </div>
              <div className="stop-card-body">
                <div className="sub-section">
                  <div className="sub-title">🏨 Hotels</div>
                  {stop.hotels.map((h, hi) => (
                    <div className="sub-card" key={hi} onClick={() => showToast(`Booking ${h.name}…`, "🏨")}>
                      <div className="sub-card-icon">{h.icon}</div>
                      <div className="sub-card-info">
                        <div className="sub-card-name">{h.name}</div>
                        <div className="sub-card-meta">{"⭐".repeat(h.stars)}{h.petFriendly ? " · 🐾 Pet-friendly" : ""}</div>
                      </div>
                      <div className="sub-card-price">{h.price}</div>
                    </div>
                  ))}
                </div>
                {amenities.restaurants && (
                  <div className="sub-section">
                    <div className="sub-title">🍽️ Restaurants</div>
                    {stop.restaurants.map((r, ri) => (
                      <div className="sub-card" key={ri} onClick={() => showToast(`Booking table at ${r.name}`, "🍽️")}>
                        <div className="sub-card-icon">🍽️</div>
                        <div className="sub-card-info">
                          <div className="sub-card-name">{r.name}</div>
                          <div className="sub-card-meta">{r.cuisine} · {r.rating}</div>
                        </div>
                        <div className="sub-card-price" style={{ fontSize: 12, color: "var(--accent2)" }}>{r.time}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="stop-actions">
                  <button className="btn-sm btn-primary" onClick={() => showToast(`Hotel reserved in ${stop.city}!`, "🏨")}>Reserve Hotel</button>
                  {amenities.grocery && (
                    <button className="btn-sm btn-green" onClick={() => setModal({ type: "grocery", city: stop.city })}>🛒 Grocery</button>
                  )}
                  <button className="btn-sm btn-outline-sm" onClick={() => showToast(`${stop.city} added to map`, "📍")}>📍 Map</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const SharePanel = () => (
    <div style={{ padding: 20 }}>
      <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Live Location Sharing</div>
      <div className="share-intro">Share your location in real time with family and friends. They get a live map link — no app required.</div>
      <div style={{ marginBottom: 16 }}>
        {[{ init: "S", name: "Sarah (wife)", status: "live" }, { init: "M", name: "Mom", status: "pending" }].map((p, i) => (
          <div className="person-row" key={i}>
            <div className="avatar">{p.init}</div>
            <div className="person-info">
              <div className="person-name">{p.name}</div>
              <div className="person-status"><span className={"status-dot " + p.status} />{p.status === "live" ? "Watching live" : "Invite pending"}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-generate" style={{ margin: 0, width: "100%" }} onClick={() => showToast("Share link copied!", "🔗")}>🔗 Copy Share Link</button>
    </div>
  );

  const GroceryModal = ({ city }) => (
    <div className="modal">
      <div className="modal-title">🛒 Grocery Delivery</div>
      <div className="modal-sub">Deliver to your hotel in {city}</div>
      <div className="grocery-input-row">
        <input className="grocery-input" placeholder="Add item…" value={groceryInput} onChange={e => setGroceryInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addGrocery()} />
        <button className="btn-sm btn-primary" style={{ flex: "none", padding: "0 16px" }} onClick={addGrocery}>Add</button>
      </div>
      <ul className="grocery-list">
        {groceryItems.length === 0 && <li style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>No items yet — add something above</li>}
        {groceryItems.map((item, i) => <li className="grocery-item" key={i}>🛒 {item}</li>)}
      </ul>
      <div className="modal-actions">
        <button className="btn-modal btn-modal-outline" onClick={() => setModal(null)}>Cancel</button>
        <button className="btn-modal btn-modal-primary" onClick={sendGroceryList}>Order Delivery</button>
      </div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <nav className="nav">
        <div className="nav-logo">Trip<span>Mappa</span></div>
        <div className="nav-tabs">
          {[["plan","Plan"],["stops","Stops"],["share","Share"]].map(([k,l]) => (
            <button key={k} className={"nav-tab" + (activeTab === k ? " active" : "")} onClick={() => setActiveTab(k)}>{l}</button>
          ))}
        </div>
        <div className="nav-actions">
          <button className="btn-icon" onClick={saveTrip} title="Save trip">💾</button>
          <button className="btn-icon" onClick={() => showToast("Share link copied!", "🔗")} title="Share">🔗</button>
        </div>
      </nav>
      <div className="app">
        <div className="sidebar">
          {activeTab === "plan" && <ConfigPanel />}
          {activeTab === "stops" && <StopsPanel />}
          {activeTab === "share" && <SharePanel />}
        </div>
        <div className="map-area">
          <div className="map-placeholder">
            <div style={{ fontSize: 64 }}>🗺️</div>
            <div className="map-placeholder-text">{generated ? `${origin} → ${destination}` : "Your route will appear here"}</div>
            <div className="map-placeholder-sub">{generated ? `${stops.length} stops · Real map coming in Phase 2` : "Enter a route and generate your trip"}</div>
          </div>
        </div>
      </div>
      {modal?.type === "grocery" && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <GroceryModal city={modal.city} />
        </div>
      )}
      {toast && <div className="toast"><span>{toast.icon}</span> {toast.msg}</div>}
    </>
  );
}