import { useState, useRef, useEffect } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
  :root {
    --ink: #111112;
    --surface: #fafafa;
    --card: #ffffff;
    --accent: #e05c2a;
    --accent2: #2a7ae0;
    --accent3: #2abf6e;
    --muted: #a0a0a0;
    --border: #ebebeb;
    --nav-h: 56px;
    --r: 10px;
    --sidebar-w: 380px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
    --shadow: 0 4px 16px rgba(0,0,0,0.08);
    --shadow-lg: 0 12px 40px rgba(0,0,0,0.12);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: var(--surface); color: var(--ink); min-height: 100vh; font-size: 13.5px; -webkit-font-smoothing: antialiased; }

  /* Nav */
  .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: var(--nav-h); background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
  .nav-logo { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: var(--ink); letter-spacing: -0.5px; }
  .nav-logo span { color: var(--accent); }
  .nav-center { display: flex; gap: 1px; background: var(--border); border-radius: 8px; padding: 3px; }
  .nav-tab { background: none; border: none; cursor: pointer; color: var(--muted); font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500; padding: 5px 14px; border-radius: 6px; transition: all 0.15s; }
  .nav-tab:hover { color: var(--ink); }
  .nav-tab.active { background: #fff; color: var(--ink); font-weight: 600; box-shadow: var(--shadow-sm); }
  .nav-right { display: flex; gap: 8px; }
  .nav-btn { background: none; border: 1px solid var(--border); cursor: pointer; color: var(--muted); border-radius: 7px; padding: 5px 12px; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; transition: all 0.15s; }
  .nav-btn:hover { border-color: #ccc; color: var(--ink); }
  .nav-btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); }
  .nav-btn-primary:hover { background: #2a2a2a; color: #fff; }

  /* Layout */
  .app { padding-top: var(--nav-h); display: flex; height: 100vh; }
  .sidebar { width: var(--sidebar-w); height: calc(100vh - var(--nav-h)); overflow-y: auto; background: var(--card); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
  .sidebar::-webkit-scrollbar { width: 0px; }
  .map-area { flex: 1; position: relative; overflow: hidden; }
  .map-placeholder { width: 100%; height: 100%; background: linear-gradient(150deg, #e8eff5 0%, #d8e8f0 60%, #c8dae8 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; }
  .map-placeholder-text { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: rgba(0,0,0,0.2); }
  .map-placeholder-sub { font-size: 12px; color: rgba(0,0,0,0.15); }

  /* Chat panel */
  .chat-wrap { display: flex; flex-direction: column; height: 100%; }
  .chat-header { padding: 24px 20px 16px; border-bottom: 1px solid var(--border); }
  .chat-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: var(--ink); margin-bottom: 3px; }
  .chat-sub { font-size: 12.5px; color: var(--muted); line-height: 1.5; }

  /* Route inputs */
  .route-wrap { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
  .route-input-wrap { position: relative; }
  .route-dot { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; border-radius: 50%; background: var(--ink); }
  .route-dot.dest { background: var(--accent); }
  .route-input { width: 100%; padding: 10px 12px 10px 30px; border: 1px solid var(--border); border-radius: 9px; font-family: 'Inter', sans-serif; font-size: 13.5px; background: var(--surface); color: var(--ink); outline: none; transition: all 0.15s; }
  .route-input:focus { border-color: var(--ink); background: #fff; box-shadow: 0 0 0 3px rgba(17,17,18,0.05); }
  .route-input::placeholder { color: #bbb; }
  .route-line { width: 1px; height: 12px; background: var(--border); margin-left: 15px; }

  /* Conversation */
  .convo-wrap { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
  .convo-wrap::-webkit-scrollbar { width: 0px; }

  /* AI message bubble */
  .ai-msg { display: flex; flex-direction: column; gap: 8px; animation: fadeUp 0.2s ease both; }
  @keyframes fadeUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
  .ai-bubble { background: var(--surface); border: 1px solid var(--border); border-radius: 12px 12px 12px 3px; padding: 11px 14px; font-size: 13.5px; line-height: 1.55; color: var(--ink); max-width: 92%; }
  .ai-name { font-size: 10.5px; font-weight: 600; color: var(--muted); letter-spacing: 0.3px; margin-bottom: 2px; }

  /* User answer bubble */
  .user-msg { display: flex; justify-content: flex-end; animation: fadeUp 0.2s ease both; }
  .user-bubble { background: var(--ink); color: #fff; border-radius: 12px 12px 3px 12px; padding: 9px 14px; font-size: 13.5px; max-width: 80%; }

  /* Quick reply buttons */
  .quick-replies { display: flex; flex-wrap: wrap; gap: 6px; }
  .qr-btn { border: 1.5px solid var(--border); background: #fff; border-radius: 99px; padding: 6px 14px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.14s; color: var(--ink); }
  .qr-btn:hover { border-color: var(--ink); background: var(--surface); }
  .qr-btn.yes { border-color: var(--accent3); color: var(--accent3); }
  .qr-btn.yes:hover { background: var(--accent3); color: #fff; }
  .qr-btn.no { border-color: var(--border); color: var(--muted); }
  .qr-btn.no:hover { border-color: #999; color: var(--ink); }
  .qr-btn.selected { background: var(--ink); color: #fff; border-color: var(--ink); }

  /* Text input answer */
  .answer-input-wrap { display: flex; gap: 7px; }
  .answer-input { flex: 1; padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 99px; font-family: 'Inter', sans-serif; font-size: 13px; outline: none; transition: all 0.15s; background: #fff; }
  .answer-input:focus { border-color: var(--ink); }
  .answer-send { background: var(--ink); color: #fff; border: none; border-radius: 99px; padding: 9px 16px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background 0.14s; white-space: nowrap; }
  .answer-send:hover { background: #333; }

  /* Summary card */
  .summary-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 12.5px; line-height: 1.7; color: var(--ink); }
  .summary-row { display: flex; gap: 8px; align-items: flex-start; }
  .summary-key { font-weight: 600; min-width: 80px; color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.3px; padding-top: 1px; }
  .summary-val { color: var(--ink); }

  /* Generate button */
  .generate-wrap { padding: 12px 20px 20px; border-top: 1px solid var(--border); }
  .btn-generate { width: 100%; padding: 12px; border: none; cursor: pointer; background: var(--ink); color: #fff; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600; transition: background 0.15s, transform 0.12s; }
  .btn-generate:hover { background: #2a2a2a; transform: translateY(-1px); }
  .btn-generate:active { transform: translateY(0); }
  .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Stops panel */
  .stops-wrap { padding: 16px; }
  .empty-state { text-align: center; padding: 64px 20px; }
  .empty-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; margin-bottom: 6px; }
  .empty-sub { font-size: 12.5px; color: var(--muted); line-height: 1.6; }
  .stop-card { background: #fff; border: 1px solid var(--border); border-radius: var(--r); margin-bottom: 10px; overflow: hidden; animation: fadeUp 0.25s ease both; }
  .stop-card-head { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .stop-num { width: 24px; height: 24px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .stop-city { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; }
  .stop-meta { font-size: 11px; color: var(--muted); margin-top: 1px; }
  .stop-body { padding: 12px 14px; }
  .stop-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); margin-bottom: 7px; margin-top: 10px; }
  .stop-section-label:first-child { margin-top: 0; }
  .item-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 7px; cursor: pointer; transition: background 0.12s; margin-bottom: 3px; border: 1px solid var(--border); background: var(--surface); }
  .item-row:hover { background: #f0f0f0; }
  .item-info { flex: 1; }
  .item-name { font-size: 13px; font-weight: 600; }
  .item-meta { font-size: 11px; color: var(--muted); margin-top: 1px; }
  .item-price { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; flex-shrink: 0; }
  .item-time { font-size: 11px; font-weight: 600; color: var(--accent2); flex-shrink: 0; }
  .fuel-row { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); margin-bottom: 7px; }
  .fuel-label { font-size: 12px; font-weight: 600; flex: 1; }
  .fuel-meta-txt { font-size: 11px; color: var(--muted); }
  .fuel-btn { background: var(--ink); color: #fff; border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .stop-actions { display: flex; gap: 6px; margin-top: 12px; }
  .action-btn { flex: 1; padding: 7px 0; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--ink); transition: all 0.14s; }
  .action-btn:hover { background: #efefef; }
  .action-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .action-btn-primary:hover { background: #c94e20; border-color: #c94e20; }

  /* Share panel */
  .share-wrap { padding: 24px 20px; }
  .share-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; margin-bottom: 4px; }
  .share-sub { font-size: 12.5px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
  .person-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; margin-bottom: 7px; background: var(--surface); border: 1px solid var(--border); }
  .avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .person-name { font-size: 13px; font-weight: 600; }
  .person-status { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px; margin-top: 1px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .dot-live { background: var(--accent3); }
  .dot-pending { background: #f5a623; }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(2px); }
  .modal { background: #fff; border-radius: 14px; padding: 24px; max-width: 360px; width: 100%; box-shadow: var(--shadow-lg); }
  .modal-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; margin-bottom: 3px; }
  .modal-sub { font-size: 12px; color: var(--muted); margin-bottom: 16px; }
  .grocery-list { list-style: none; margin-bottom: 12px; max-height: 160px; overflow-y: auto; }
  .grocery-item { padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .grocery-item:last-child { border-bottom: none; }
  .grocery-input-row { display: flex; gap: 7px; margin-bottom: 14px; }
  .grocery-input { flex: 1; padding: 8px 11px; border: 1px solid var(--border); border-radius: 7px; font-family: 'Inter', sans-serif; font-size: 13px; outline: none; }
  .grocery-input:focus { border-color: var(--ink); }
  .modal-footer { display: flex; gap: 8px; }
  .modal-btn { flex: 1; padding: 10px; border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }
  .modal-btn-primary { background: var(--ink); color: #fff; }
  .modal-btn-outline { background: var(--surface); color: var(--ink); border: 1px solid var(--border); }

  /* Toast */
  .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 300; background: var(--ink); color: #fff; padding: 10px 18px; border-radius: 99px; font-size: 13px; font-weight: 500; box-shadow: var(--shadow-lg); animation: toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1); white-space: nowrap; }
  @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

  .section-sep { height: 1px; background: var(--border); margin: 4px 0 12px; }

  /* Cost card */
  .cost-card { background: var(--ink); border-radius: var(--r); padding: 18px; margin-top: 16px; }
  .cost-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 3px; }
  .cost-subtitle { font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 16px; line-height: 1.5; }
  .cost-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px; }
  .cost-row { display: flex; justify-content: space-between; align-items: center; }
  .cost-label { font-size: 12.5px; color: rgba(255,255,255,0.6); }
  .cost-val { font-size: 12.5px; font-weight: 600; color: #fff; }
  .cost-total-row { display: flex; justify-content: space-between; align-items: center; }
  .cost-total-label { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); }
  .cost-total-val { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
`;

// ── Conversation script ───────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: "vehicle",
    ask: "What are you traveling in?",
    type: "choice",
    choices: ["Car", "RV / Camper", "Semi Truck", "Motorcycle", "Trailer"],
  },
  {
    id: "trailer_detail",
    ask: "Got it — what's the trailer weight and length? (e.g. 14,000 lbs, 40 ft)",
    type: "text",
    placeholder: "e.g. 14,000 lbs, 40 ft",
    onlyIf: (ans) => ans.vehicle === "Trailer" || ans.vehicle === "Semi Truck",
  },
  {
    id: "fuel",
    ask: "Does your vehicle run on gasoline or electric?",
    type: "choice",
    choices: ["Gasoline", "Electric (EV)"],
  },
  {
    id: "pets",
    ask: "Traveling with any pets?",
    type: "yesno",
  },
  {
    id: "pet_desc",
    ask: "Tell us about your pet — type, size, anything we should know.",
    type: "text",
    placeholder: "e.g. large golden retriever, very friendly",
    onlyIf: (ans) => ans.pets === "Yes",
  },
  {
    id: "lodging",
    ask: "What kind of lodging do you prefer?",
    type: "choice",
    choices: ["Budget", "Mid-range", "Upscale", "Luxury", "Campground", "RV Park"],
  },
  {
    id: "restaurants",
    ask: "Want restaurant recommendations at each stop?",
    type: "yesno",
  },
  {
    id: "grocery",
    ask: "Would you like grocery delivery to your hotel?",
    type: "yesno",
  },
  {
    id: "extra",
    ask: "Anything else we should know? (optional — press Skip to continue)",
    type: "text",
    placeholder: "e.g. need wide parking, traveling with kids, prefer highways...",
    skippable: true,
  },
];

const STOPS_DATA = [
  {
    city: "Amarillo, TX", distance: "263 mi", eta: "3h 45m",
    hotels: [
      { name: "Amarillo Grand Hotel", stars: 4, price: "$129/night", pet: true },
      { name: "Big Texan Inn", stars: 3, price: "$89/night", pet: false },
    ],
    restaurants: [
      { name: "The Big Texan Steak Ranch", cuisine: "Steakhouse", rating: "4.6", time: "7:00 PM" },
      { name: "Crush Wine Bar", cuisine: "American", rating: "4.4", time: "8:00 PM" },
    ],
  },
  {
    city: "Albuquerque, NM", distance: "289 mi", eta: "4h 10m",
    hotels: [
      { name: "Hotel Albuquerque", stars: 4, price: "$149/night", pet: true },
      { name: "Nativo Lodge", stars: 3, price: "$99/night", pet: false },
    ],
    restaurants: [
      { name: "Sadie's of New Mexico", cuisine: "New Mexican", rating: "4.5", time: "7:00 PM" },
      { name: "Casa de Benavidez", cuisine: "Mexican", rating: "4.3", time: "8:00 PM" },
    ],
  },
  {
    city: "Flagstaff, AZ", distance: "321 mi", eta: "4h 45m",
    hotels: [
      { name: "Little America Hotel", stars: 4, price: "$159/night", pet: true },
      { name: "Drury Inn Flagstaff", stars: 3, price: "$109/night", pet: false },
    ],
    restaurants: [
      { name: "Tinderbox Kitchen", cuisine: "American", rating: "4.7", time: "7:00 PM" },
      { name: "Brix Restaurant", cuisine: "Fine Dining", rating: "4.6", time: "8:00 PM" },
    ],
  },
];

export default function App() {
  const [tab, setTab] = useState("plan");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");

  // Conversation state
  const [convo, setConvo] = useState([]); // [{role, text}]
  const [answers, setAnswers] = useState({});
  const [qIndex, setQIndex] = useState(-1); // -1 = not started
  const [textInput, setTextInput] = useState("");
  const [convoComplete, setConvoComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [stops, setStops] = useState([]);

  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [groceryInput, setGroceryInput] = useState("");
  const [groceryItems, setGroceryItems] = useState([]);

  const convoEndRef = useRef(null);
  useEffect(() => { convoEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [convo]);

  function toast_(msg) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  // Find next applicable question index
  function nextQIndex(fromIndex, currentAnswers) {
    let i = fromIndex;
    while (i < QUESTIONS.length) {
      const q = QUESTIONS[i];
      if (!q.onlyIf || q.onlyIf(currentAnswers)) return i;
      i++;
    }
    return -2; // done
  }

  function startConvo() {
    if (!origin || !dest) { toast_("Enter origin and destination first"); return; }
    const first = nextQIndex(0, {});
    setQIndex(first);
    setConvo([{ role: "ai", text: `Great! Planning your trip from ${origin} to ${dest}. I have a few quick questions.` },
              { role: "ai", text: QUESTIONS[first].ask }]);
  }

  function submitAnswer(value) {
    const q = QUESTIONS[qIndex];
    const newAnswers = { ...answers, [q.id]: value };
    setAnswers(newAnswers);
    setTextInput("");

    const newConvo = [...convo, { role: "user", text: value }];

    const next = nextQIndex(qIndex + 1, newAnswers);
    if (next === -2) {
      setConvo([...newConvo, { role: "ai", text: "Perfect — here's what I've got. Ready to generate your trip?" }]);
      setQIndex(-2);
      setConvoComplete(true);
    } else {
      setConvo([...newConvo, { role: "ai", text: QUESTIONS[next].ask }]);
      setQIndex(next);
    }
  }

  async function generateTrip() {
    setLoading(true); setTab("stops");
    await new Promise(r => setTimeout(r, 1800));
    setStops(STOPS_DATA);
    setLoading(false); setGenerated(true);
    toast_("Trip planned");
  }

  function resetPlan() {
    setConvo([]); setAnswers({}); setQIndex(-1);
    setConvoComplete(false); setGenerated(false); setStops([]);
    setOrigin(""); setDest("");
  }

  const currentQ = qIndex >= 0 ? QUESTIONS[qIndex] : null;

  // Summary of answers
  function SummaryCard() {
    const rows = [
      ["Vehicle", answers.vehicle],
      answers.trailer_detail && ["Trailer", answers.trailer_detail],
      ["Fuel", answers.fuel],
      ["Pets", answers.pets === "Yes" ? `Yes — ${answers.pet_desc || ""}` : "No"],
      ["Lodging", answers.lodging],
      ["Restaurants", answers.restaurants],
      ["Grocery delivery", answers.grocery],
      answers.extra && answers.extra !== "skip" && ["Notes", answers.extra],
    ].filter(Boolean);

    return (
      <div className="summary-card">
        {rows.map(([k, v]) => (
          <div className="summary-row" key={k} style={{ marginBottom: 6 }}>
            <div className="summary-key">{k}</div>
            <div className="summary-val">{v}</div>
          </div>
        ))}
      </div>
    );
  }

  const planPanel = (
    <div className="chat-wrap">
      <div className="chat-header">
        <div className="chat-title">Plan your<br />road trip.</div>
        <div className="chat-sub">Answer a few quick questions and we'll handle the rest.</div>
      </div>

      <div className="route-wrap">
        <div className="route-input-wrap">
          <div className="route-dot" />
          <input className="route-input" placeholder="Starting from…" value={origin} onChange={e => setOrigin(e.target.value)} />
        </div>
        <div className="route-line" />
        <div className="route-input-wrap">
          <div className="route-dot dest" />
          <input className="route-input" placeholder="Going to…" value={dest} onChange={e => setDest(e.target.value)} />
        </div>
      </div>

      <div className="convo-wrap">
        {qIndex === -1 && convo.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Enter your route above, then tap below to get started.</div>
            <button className="btn-generate" style={{ width: "auto", padding: "10px 28px", display: "inline-block" }} onClick={startConvo}>
              Start planning
            </button>
          </div>
        )}

        {convo.map((msg, i) => (
          msg.role === "ai" ? (
            <div className="ai-msg" key={i}>
              {i === 0 && <div className="ai-name">TripMappa</div>}
              <div className="ai-bubble">{msg.text}</div>
            </div>
          ) : (
            <div className="user-msg" key={i}>
              <div className="user-bubble">{msg.text}</div>
            </div>
          )
        ))}

        {currentQ && (
          <div className="ai-msg">
            {currentQ.type === "yesno" && (
              <div className="quick-replies">
                <button className="qr-btn yes" onClick={() => submitAnswer("Yes")}>Yes</button>
                <button className="qr-btn no" onClick={() => submitAnswer("No")}>No</button>
              </div>
            )}
            {currentQ.type === "choice" && (
              <div className="quick-replies">
                {currentQ.choices.map(c => (
                  <button key={c} className="qr-btn" onClick={() => submitAnswer(c)}>{c}</button>
                ))}
              </div>
            )}
            {currentQ.type === "text" && (
              <div className="answer-input-wrap">
                <input
                  className="answer-input"
                  placeholder={currentQ.placeholder}
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && textInput.trim() && submitAnswer(textInput.trim())}
                />
                {currentQ.skippable && (
                  <button className="answer-send" style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }} onClick={() => submitAnswer("skip")}>Skip</button>
                )}
                <button className="answer-send" onClick={() => textInput.trim() && submitAnswer(textInput.trim())}>Send</button>
              </div>
            )}
          </div>
        )}

        {convoComplete && (
          <div className="ai-msg">
            <SummaryCard />
          </div>
        )}

        <div ref={convoEndRef} />
      </div>

      {convoComplete && (
        <div className="generate-wrap">
          <button className="btn-generate" onClick={generateTrip} disabled={loading}>
            {loading ? <><span className="spinner" />Planning your trip…</> : "Generate Trip Plan"}
          </button>
        </div>
      )}
    </div>
  );

  const StopsPanel = () => (
    <div className="stops-wrap">
      {!generated ? (
        <div className="empty-state">
          <div className="empty-title">No trip yet</div>
          <div className="empty-sub">Go to Plan, answer the questions,<br />and hit Generate Trip Plan.</div>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontFamily:"Syne", fontWeight:700, fontSize:15 }}>{origin} → {dest}</div>
            <button className="action-btn" style={{ flex:"none", padding:"5px 12px", fontSize:11 }} onClick={resetPlan}>Edit trip</button>
          </div>

          <div className="section-sep" />

          <div style={{ fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", color:"var(--muted)", marginBottom:8 }}>Overnight stops</div>
          {stops.map((stop, i) => (
            <div className="stop-card" key={i} style={{ animationDelay: i*0.07+"s" }}>
              <div className="stop-card-head">
                <div className="stop-num">{i+1}</div>
                <div>
                  <div className="stop-city">{stop.city}</div>
                  <div className="stop-meta">{stop.distance} · {stop.eta} drive</div>
                </div>
              </div>
              <div className="stop-body">
                <div className="stop-section-label">Hotels</div>
                {stop.hotels.map((h, hi) => (
                  <div className="item-row" key={hi} onClick={() => toast_(`Booking ${h.name}`)}>
                    <div className="item-info">
                      <div className="item-name">{h.name}</div>
                      <div className="item-meta">{h.stars}-star{h.pet ? " · Pet-friendly" : ""}</div>
                    </div>
                    <div className="item-price">{h.price}</div>
                  </div>
                ))}
                {answers.restaurants === "Yes" && (
                  <>
                    <div className="stop-section-label">Restaurants</div>
                    {stop.restaurants.map((r, ri) => (
                      <div className="item-row" key={ri} onClick={() => toast_(`Booking ${r.name}`)}>
                        <div className="item-info">
                          <div className="item-name">{r.name}</div>
                          <div className="item-meta">{r.cuisine} · {r.rating} stars</div>
                        </div>
                        <div className="item-time">{r.time}</div>
                      </div>
                    ))}
                  </>
                )}
                <div className="stop-actions">
                  <button className="action-btn action-btn-primary" onClick={() => toast_("Hotel reserved!")}>Reserve hotel</button>
                  {answers.grocery === "Yes" && (
                    <button className="action-btn" onClick={() => setModal({ type:"grocery", city:stop.city })}>Grocery</button>
                  )}
                  <button className="action-btn" onClick={() => toast_("Added to map")}>Map</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const SharePanel = () => (
    <div className="share-wrap">
      <div className="share-title">Live sharing</div>
      <div className="share-sub">Share your location in real time. Friends and family get a live map link — no app needed.</div>
      {[{init:"S",name:"Sarah",status:"live"},{init:"M",name:"Mom",status:"pending"}].map((p,i) => (
        <div className="person-row" key={i}>
          <div className="avatar">{p.init}</div>
          <div style={{flex:1}}>
            <div className="person-name">{p.name}</div>
            <div className="person-status">
              <span className={"dot dot-"+(p.status==="live"?"live":"pending")} />
              {p.status==="live" ? "Watching live" : "Invite pending"}
            </div>
          </div>
        </div>
      ))}
      <button className="btn-generate" style={{marginTop:16}} onClick={() => toast_("Link copied")}>Copy share link</button>
    </div>
  );

  const GroceryModal = ({city}) => (
    <div className="modal">
      <div className="modal-title">Grocery delivery</div>
      <div className="modal-sub">Delivered to your hotel in {city}</div>
      <div className="grocery-input-row">
        <input className="grocery-input" placeholder="Add item…" value={groceryInput} onChange={e => setGroceryInput(e.target.value)} onKeyDown={e => e.key==="Enter" && (() => { if(groceryInput.trim()) { setGroceryItems(g=>[...g,groceryInput.trim()]); setGroceryInput(""); } })()} />
        <button className="modal-btn modal-btn-primary" style={{flex:"none",padding:"0 14px",borderRadius:7}} onClick={() => { if(groceryInput.trim()) { setGroceryItems(g=>[...g,groceryInput.trim()]); setGroceryInput(""); } }}>Add</button>
      </div>
      <ul className="grocery-list">
        {groceryItems.length===0 && <li style={{color:"var(--muted)",fontSize:12,padding:"8px 0"}}>No items yet</li>}
        {groceryItems.map((item,i) => <li className="grocery-item" key={i}>{item}</li>)}
      </ul>
      <div className="modal-footer">
        <button className="modal-btn modal-btn-outline" onClick={() => setModal(null)}>Cancel</button>
        <button className="modal-btn modal-btn-primary" onClick={() => { toast_("Grocery order placed"); setModal(null); }}>Place order</button>
      </div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <nav className="nav">
        <div className="nav-logo">Trip<span>Mappa</span></div>
        <div className="nav-center">
          {[["plan","Plan"],["stops","Stops"],["share","Share"]].map(([k,l]) => (
            <button key={k} className={"nav-tab"+(tab===k?" active":"")} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="nav-right">
          <button className="nav-btn" onClick={() => toast_("Trip saved")}>Save trip</button>
          <button className="nav-btn nav-btn-primary" onClick={() => toast_("Link copied")}>Share</button>
        </div>
      </nav>

      <div className="app">
        <div className="sidebar">
          {tab==="plan"  && planPanel}
          {tab==="stops" && <StopsPanel />}
          {tab==="share" && <SharePanel />}
        </div>
        <div className="map-area">
          <div className="map-placeholder">
            <div className="map-placeholder-text">{generated ? `${origin} → ${dest}` : "Your route will appear here"}</div>
            <div className="map-placeholder-sub">{generated ? `${stops.length} stops · Real map coming in Phase 2` : "Plan your trip to get started"}</div>
          </div>
        </div>
      </div>

      {modal?.type==="grocery" && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setModal(null); }}>
          <GroceryModal city={modal.city} />
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
