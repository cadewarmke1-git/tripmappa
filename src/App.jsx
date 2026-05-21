import { useState, useRef, useEffect } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800;900&display=swap');
  :root {
    --ink: #0f1923;
    --surface: #fafaf8;
    --card: #ffffff;
    --accent: #e07c3a;
    --accent2: #4a9fd4;
    --accent3: #2abf6e;
    --muted: #8a8a8a;
    --border: #e8e4de;
    --nav-h: 60px;
    --r: 12px;
    --sidebar-w: 380px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
    --shadow: 0 4px 20px rgba(0,0,0,0.1);
    --shadow-lg: 0 16px 50px rgba(0,0,0,0.15);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: var(--surface); color: var(--ink); min-height: 100vh; font-size: 13.5px; -webkit-font-smoothing: antialiased; }

  /* ── Nav ── */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: var(--nav-h);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 32px;
    transition: background 0.4s, border-color 0.4s, backdrop-filter 0.4s;
  }
  .nav.transparent { background: transparent; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .nav.solid { background: rgba(255,255,255,0.95); border-bottom: 1px solid var(--border); backdrop-filter: blur(12px); }
  .nav-logo { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
  .nav.transparent .nav-logo { color: #fff; }
  .nav.solid .nav-logo { color: var(--ink); }
  .nav.transparent .nav-logo span { color: rgba(255,210,140,0.9); }
  .nav.solid .nav-logo span { color: var(--accent); }
  .nav-center { display: flex; gap: 1px; border-radius: 8px; padding: 3px; }
  .nav.transparent .nav-center { background: rgba(255,255,255,0.12); }
  .nav.solid .nav-center { background: var(--border); }
  .nav-tab { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500; padding: 5px 14px; border-radius: 6px; transition: all 0.15s; }
  .nav.transparent .nav-tab { color: rgba(255,255,255,0.65); }
  .nav.transparent .nav-tab:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .nav.transparent .nav-tab.active { background: rgba(255,255,255,0.2); color: #fff; font-weight: 600; }
  .nav.solid .nav-tab { color: var(--muted); }
  .nav.solid .nav-tab:hover { color: var(--ink); }
  .nav.solid .nav-tab.active { background: #fff; color: var(--ink); font-weight: 600; box-shadow: var(--shadow-sm); }
  .nav-right { display: flex; gap: 8px; }
  .nav-btn { border: 1px solid; cursor: pointer; border-radius: 7px; padding: 6px 14px; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; transition: all 0.15s; }
  .nav.transparent .nav-btn { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); color: #fff; }
  .nav.transparent .nav-btn:hover { background: rgba(255,255,255,0.22); }
  .nav.transparent .nav-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .nav.solid .nav-btn { background: none; border-color: var(--border); color: var(--muted); }
  .nav.solid .nav-btn:hover { border-color: #ccc; color: var(--ink); }
  .nav.solid .nav-btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); }

  /* ── Hero ── */
  .hero {
    position: relative; min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .hero.day {
    background: linear-gradient(180deg,#87CEEB 0%,#a8d8ea 18%,#c8e8c0 38%,#a8c878 52%,#8ab560 62%,#6d9e4a 72%,#4a7a6a 82%,#2d5a52 92%,#1a3d38 100%);
  }
  .hero.night {
    background: linear-gradient(180deg,#020818 0%,#050d2a 20%,#0a1840 40%,#0d2255 55%,#1a3a6a 65%,#3a2a15 78%,#6b3d10 88%,#8a5020 95%,#020818 100%);
  }
  /* Pseudo-element trick for smooth background transition */
  .hero::before {
    content: ''; position: absolute; inset: 0;
    background: inherit;
    transition: opacity 1.4s ease;
    z-index: 0;
  }

  /* Road SVG overlay */
  .hero-road {
    position: absolute; bottom: 0; left: 0; right: 0; height: 55%;
    opacity: 0.18;
    background: linear-gradient(to top, rgba(255,255,255,0.08), transparent);
  }

  /* Stars */
  .hero-stars {
    position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  }
  .star {
    position: absolute; border-radius: 50%; background: #fff;
    animation: twinkle var(--dur) ease-in-out infinite alternate;
  }
  @keyframes twinkle { from { opacity: var(--lo); } to { opacity: var(--hi); } }

  /* Horizon glow — river shimmer */
  .hero-glow {
    position: absolute; bottom: 20%; left: 50%; transform: translateX(-50%);
    width: 60%; height: 120px;
    background: radial-gradient(ellipse at center, rgba(150,210,200,0.35) 0%, rgba(100,180,170,0.15) 50%, transparent 80%);
    pointer-events: none;
  }

  /* Road perspective */
  .hero-road-svg {
    position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 900px; opacity: 0.22; pointer-events: none;
  }

  /* Hero content */
  .hero-content {
    position: relative; z-index: 10;
    text-align: center; padding: 0 20px;
    width: 100%; max-width: 620px;
    animation: heroIn 1s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes heroIn { from { opacity:0; transform: translateY(30px); } to { opacity:1; transform: translateY(0); } }

  .hero-eyebrow {
    font-size: 13px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(255,255,255,0.9); margin-bottom: 16px;
    font-family: 'Syne', sans-serif;
  }

  .hero-title {
    font-family: 'Syne', sans-serif; font-weight: 900;
    font-size: clamp(36px, 7vw, 86px);
    line-height: 1.0; letter-spacing: -2px;
    color: #fff; margin-bottom: 16px;
    text-shadow: 0 2px 20px rgba(0,0,0,0.2), 0 4px 60px rgba(0,0,0,0.15);
  }
  .hero-title .highlight {
    background: linear-gradient(135deg, #ffd700, #f0a830);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-size: 14px; color: rgba(255,255,255,0.7); max-width: 400px;
    margin: 0 auto 32px; line-height: 1.5; font-weight: 400; letter-spacing: 0.2px;
  }

  /* Hero search bar */
  .hero-search {
    background: rgba(255,255,255,0.97);
    border-radius: 16px; padding: 10px 10px 10px 20px;
    display: flex; align-items: center; gap: 12px;
    width: 100%; max-width: 560px; margin: 0 auto 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
    animation: heroIn 1s 0.2s cubic-bezier(0.16,1,0.3,1) both;
  }
  @media (max-width: 540px) {
    .hero-search { flex-direction: column; padding: 14px; border-radius: 14px; gap: 8px; }
    .hero-search-divider { width: 100%; height: 1px; }
    .hero-input-wrap { width: 100%; }
    .hero-go-btn { width: 100%; text-align: center; justify-content: center; }
    .hero-title { letter-spacing: -1px; }
    .hero-auth-btns { flex-wrap: wrap; }
    .hero-pill { font-size: 11px; padding: 5px 12px; }
  }
  .hero-search-divider { width: 1px; height: 28px; background: #e8e4de; flex-shrink: 0; }
  .hero-input-wrap { flex: 1; display: flex; flex-direction: column; }
  .hero-input-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #aaa; margin-bottom: 2px; }
  .hero-input {
    border: none; outline: none; font-family: 'Inter', sans-serif;
    font-size: 14px; font-weight: 500; color: var(--ink);
    background: transparent; width: 100%; padding: 0;
  }
  .hero-input::placeholder { color: #bbb; font-weight: 400; }
  .hero-go-btn {
    background: linear-gradient(135deg, var(--accent), #d06a28);
    color: #fff; border: none; border-radius: 10px;
    padding: 12px 22px; font-family: 'Syne', sans-serif;
    font-size: 14px; font-weight: 700; cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s; white-space: nowrap;
    box-shadow: 0 4px 16px rgba(224,124,58,0.4);
    flex-shrink: 0;
  }
  .hero-go-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(224,124,58,0.5); }
  .hero-go-btn:active { transform: translateY(0); }

  .hero-hint {
    font-size: 12px; color: rgba(255,255,255,0.45);
    animation: heroIn 1s 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }
  .hero-hint span { color: rgba(255,210,140,0.7); }

  /* Auth buttons */
  .hero-auth { margin-bottom: 28px; animation: heroIn 1s 0.35s cubic-bezier(0.16,1,0.3,1) both; }
  .hero-auth-label { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 10px; }
  .hero-auth-btns { display: flex; gap: 8px; justify-content: center; }
  .hero-auth-btn { display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.95); border: none; border-radius: 9px; padding: 9px 18px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; transition: all 0.15s; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
  .hero-auth-btn:hover { background: #fff; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }

  /* Feature pills */
  .hero-pills {
    display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
    margin-top: 48px;
    animation: heroIn 1s 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }
  .hero-pill {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 99px; padding: 7px 16px;
    font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.75);
    backdrop-filter: blur(8px);
  }

  /* Night/Day toggle switch */
  .theme-switch { display: flex; align-items: center; cursor: pointer; user-select: none; }
  .theme-switch-track {
    width: 52px; height: 28px; border-radius: 99px;
    position: relative; transition: background 0.35s;
    border: 1px solid rgba(255,255,255,0.2);
    flex-shrink: 0;
  }
  .theme-switch-track.day { background: rgba(135,206,235,0.5); }
  .theme-switch-track.night { background: rgba(10,20,60,0.6); }
  .theme-switch-thumb {
    position: absolute; top: 3px;
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; transition: left 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.35s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  .theme-switch-thumb.day { left: 3px; background: #fff9e0; }
  .theme-switch-thumb.night { left: 27px; background: #1a2744; }
  .scroll-indicator {
    position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: rgba(255,255,255,0.35); font-size: 11px; letter-spacing: 1px;
    text-transform: uppercase; animation: bounce 2s ease-in-out infinite;
  }
  @keyframes bounce { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(6px); } }
  .scroll-arrow { width: 18px; height: 18px; border-right: 1.5px solid rgba(255,255,255,0.35); border-bottom: 1.5px solid rgba(255,255,255,0.35); transform: rotate(45deg); margin-top: -4px; }

  /* ── App layout (post-hero) ── */
  .app { padding-top: var(--nav-h); display: flex; height: 100vh; }
  .sidebar { width: var(--sidebar-w); height: calc(100vh - var(--nav-h)); overflow-y: auto; background: var(--card); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
  .sidebar::-webkit-scrollbar { width: 0px; }
  .map-area { flex: 1; position: relative; overflow: hidden; }
  .map-placeholder { width: 100%; height: 100%; background: linear-gradient(150deg, #e4eef5 0%, #d2e4f0 60%, #c0d6e8 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; }
  .map-placeholder-text { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: rgba(0,0,0,0.2); }
  .map-placeholder-sub { font-size: 12px; color: rgba(0,0,0,0.15); }

  /* ── Chat panel ── */
  .chat-wrap { display: flex; flex-direction: column; height: 100%; }
  .chat-header { padding: 24px 20px 16px; border-bottom: 1px solid var(--border); }
  .chat-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: var(--ink); margin-bottom: 3px; }
  .chat-sub { font-size: 12.5px; color: var(--muted); line-height: 1.5; }
  .route-wrap { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
  .route-input-wrap { position: relative; }
  .route-dot { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; border-radius: 50%; background: var(--ink); }
  .route-dot.dest { background: var(--accent); }
  .route-input { width: 100%; padding: 10px 12px 10px 30px; border: 1px solid var(--border); border-radius: 9px; font-family: 'Inter', sans-serif; font-size: 13.5px; background: var(--surface); color: var(--ink); outline: none; transition: all 0.15s; }
  .route-input:focus { border-color: var(--ink); background: #fff; box-shadow: 0 0 0 3px rgba(15,25,35,0.06); }
  .route-input::placeholder { color: #bbb; }
  .route-line { width: 1px; height: 12px; background: var(--border); margin-left: 15px; }
  .convo-wrap { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
  .convo-wrap::-webkit-scrollbar { width: 0px; }
  .ai-msg { display: flex; flex-direction: column; gap: 8px; animation: fadeUp 0.2s ease both; }
  @keyframes fadeUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
  .ai-bubble { background: var(--surface); border: 1px solid var(--border); border-radius: 12px 12px 12px 3px; padding: 11px 14px; font-size: 13.5px; line-height: 1.55; color: var(--ink); max-width: 92%; }
  .ai-name { font-size: 10.5px; font-weight: 600; color: var(--muted); letter-spacing: 0.3px; margin-bottom: 2px; }
  .user-msg { display: flex; justify-content: flex-end; animation: fadeUp 0.2s ease both; }
  .user-bubble { background: var(--ink); color: #fff; border-radius: 12px 12px 3px 12px; padding: 9px 14px; font-size: 13.5px; max-width: 80%; }
  .quick-replies { display: flex; flex-wrap: wrap; gap: 6px; }
  .qr-btn { border: 1.5px solid var(--border); background: #fff; border-radius: 99px; padding: 6px 14px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.14s; color: var(--ink); }
  .qr-btn:hover { border-color: var(--ink); background: var(--surface); }
  .qr-btn.yes { border-color: var(--accent3); color: var(--accent3); }
  .qr-btn.yes:hover { background: var(--accent3); color: #fff; }
  .qr-btn.no { border-color: #e05c2a; color: #e05c2a; }
  .qr-btn.no:hover { background: #e05c2a; color: #fff; border-color: #e05c2a; }
  .answer-input-wrap { display: flex; gap: 7px; }
  .answer-input { flex: 1; padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 99px; font-family: 'Inter', sans-serif; font-size: 13px; outline: none; transition: all 0.15s; background: #fff; }
  .answer-input:focus { border-color: var(--ink); }
  .answer-send { background: var(--ink); color: #fff; border: none; border-radius: 99px; padding: 9px 16px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background 0.14s; white-space: nowrap; }
  .answer-send:hover { background: #333; }
  .summary-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 12.5px; line-height: 1.7; }
  .summary-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px; }
  .summary-key { font-weight: 600; min-width: 80px; color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.3px; padding-top: 1px; }
  .generate-wrap { padding: 12px 20px 20px; border-top: 1px solid var(--border); }
  .btn-generate { width: 100%; padding: 12px; border: none; cursor: pointer; background: var(--ink); color: #fff; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600; transition: background 0.15s, transform 0.12s; }
  .btn-generate:hover { background: #2a2a2a; transform: translateY(-1px); }
  .btn-generate:active { transform: translateY(0); }
  .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Stops panel ── */
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
  .action-btn-primary:hover { background: #c96820; border-color: #c96820; }
  .section-sep { height: 1px; background: var(--border); margin: 4px 0 12px; }

  /* ── Share panel ── */
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

  /* ── Modal ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(3px); }
  .modal { background: #fff; border-radius: 16px; padding: 24px; max-width: 360px; width: 100%; box-shadow: var(--shadow-lg); }
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

  /* ── Toast ── */
  .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 300; background: var(--ink); color: #fff; padding: 10px 18px; border-radius: 99px; font-size: 13px; font-weight: 500; box-shadow: var(--shadow-lg); animation: toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1); white-space: nowrap; }
  @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
`;

const QUESTIONS = [
  { id:"vehicle", ask:"What are you traveling in?", type:"choice", choices:["Car","RV / Camper","Semi Truck","Motorcycle","Trailer"] },
  { id:"trailer_detail", ask:"Got it — what's the trailer weight and length?", type:"text", placeholder:"e.g. 14,000 lbs, 40 ft", onlyIf:(a)=>a.vehicle==="Trailer"||a.vehicle==="Semi Truck" },
  { id:"fuel", ask:"Does your vehicle run on gasoline or electric?", type:"choice", choices:["Gasoline","Electric (EV)"] },
  { id:"pets", ask:"Traveling with any pets?", type:"yesno" },
  { id:"pet_desc", ask:"Tell us about your pet — type, size, anything we should know.", type:"text", placeholder:"e.g. large golden retriever", onlyIf:(a)=>a.pets==="Yes" },
  { id:"lodging", ask:"What kind of lodging do you prefer?", type:"choice", choices:["Budget","Mid-range","Upscale","Luxury","Campground","RV Park"] },
  { id:"restaurants", ask:"Want restaurant recommendations at each stop?", type:"yesno" },
  { id:"grocery", ask:"Would you like grocery delivery to your hotel?", type:"yesno" },
  { id:"extra", ask:"Anything else we should know? (optional)", type:"text", placeholder:"e.g. traveling with kids, need wide parking…", skippable:true },
];

const STOPS_DATA = [
  { city:"Amarillo, TX", distance:"263 mi", eta:"3h 45m",
    hotels:[{name:"Amarillo Grand Hotel",stars:4,price:"$129/night",pet:true},{name:"Big Texan Inn",stars:3,price:"$89/night",pet:false}],
    restaurants:[{name:"The Big Texan Steak Ranch",cuisine:"Steakhouse",rating:"4.6",time:"7:00 PM"},{name:"Crush Wine Bar",cuisine:"American",rating:"4.4",time:"8:00 PM"}] },
  { city:"Albuquerque, NM", distance:"289 mi", eta:"4h 10m",
    hotels:[{name:"Hotel Albuquerque",stars:4,price:"$149/night",pet:true},{name:"Nativo Lodge",stars:3,price:"$99/night",pet:false}],
    restaurants:[{name:"Sadie's of New Mexico",cuisine:"New Mexican",rating:"4.5",time:"7:00 PM"},{name:"Casa de Benavidez",cuisine:"Mexican",rating:"4.3",time:"8:00 PM"}] },
  { city:"Flagstaff, AZ", distance:"321 mi", eta:"4h 45m",
    hotels:[{name:"Little America Hotel",stars:4,price:"$159/night",pet:true},{name:"Drury Inn Flagstaff",stars:3,price:"$109/night",pet:false}],
    restaurants:[{name:"Tinderbox Kitchen",cuisine:"American",rating:"4.7",time:"7:00 PM"},{name:"Brix Restaurant",cuisine:"Fine Dining",rating:"4.6",time:"8:00 PM"}] },
];

// Generate stars
function Stars() {
  const stars = Array.from({length:80},(_,i)=>({
    id:i, top:`${Math.random()*65}%`, left:`${Math.random()*100}%`,
    size: Math.random()<0.3 ? 2 : Math.random()<0.6 ? 1.5 : 1,
    lo: (Math.random()*0.3+0.1).toFixed(2), hi: (Math.random()*0.5+0.5).toFixed(2),
    dur: `${(Math.random()*3+2).toFixed(1)}s`,
  }));
  return (
    <div className="hero-stars">
      {stars.map(s=>(
        <div key={s.id} className="star" style={{
          top:s.top, left:s.left, width:s.size, height:s.size,
          '--lo':s.lo, '--hi':s.hi, '--dur':s.dur,
        }}/>
      ))}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("hero"); // "hero" | "app"
  const [tab, setTab] = useState("plan");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [heroOrigin, setHeroOrigin] = useState("");
  const [heroDest, setHeroDest] = useState("");
  const [convo, setConvo] = useState([]);
  const [answers, setAnswers] = useState({});
  const [qIndex, setQIndex] = useState(-1);
  const [textInput, setTextInput] = useState("");
  const [convoComplete, setConvoComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [stops, setStops] = useState([]);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [groceryInput, setGroceryInput] = useState("");
  const [groceryItems, setGroceryItems] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [heroTheme, setHeroTheme] = useState("day"); // "day" | "night"

  const convoEndRef = useRef(null);
  useEffect(()=>{ convoEndRef.current?.scrollIntoView({behavior:"smooth"}); },[convo]);

  useEffect(()=>{
    function onScroll() { setScrolled(window.scrollY > 40); }
    window.addEventListener("scroll", onScroll);
    return ()=>window.removeEventListener("scroll", onScroll);
  },[]);

  function toast_(msg) { setToast(msg); setTimeout(()=>setToast(null),2400); }

  function launchFromHero() {
    if (!heroOrigin || !heroDest) { toast_("Enter your starting point and destination"); return; }
    setOrigin(heroOrigin); setDest(heroDest);
    setView("app");
    window.scrollTo(0,0);
    setTimeout(()=>{
      const first = nextQ(0,{});
      setQIndex(first);
      setConvo([
        {role:"ai", text:`Let's plan your trip from ${heroOrigin} to ${heroDest}. A few quick questions:`},
        {role:"ai", text:QUESTIONS[first].ask}
      ]);
    }, 100);
  }

  function nextQ(from, ans) {
    let i=from;
    while(i<QUESTIONS.length) { const q=QUESTIONS[i]; if(!q.onlyIf||q.onlyIf(ans)) return i; i++; }
    return -2;
  }

  function startConvo() {
    if(!origin||!dest){toast_("Enter origin and destination first");return;}
    const first=nextQ(0,{});
    setQIndex(first);
    setConvo([{role:"ai",text:`Planning your trip from ${origin} to ${dest}. A few quick questions:`},{role:"ai",text:QUESTIONS[first].ask}]);
  }

  function submitAnswer(value) {
    const q=QUESTIONS[qIndex];
    const na={...answers,[q.id]:value};
    setAnswers(na); setTextInput("");
    const nc=[...convo,{role:"user",text:value}];
    const next=nextQ(qIndex+1,na);
    if(next===-2) { setConvo([...nc,{role:"ai",text:"Perfect — here's what I've got. Ready to plan your trip?"}]); setQIndex(-2); setConvoComplete(true); }
    else { setConvo([...nc,{role:"ai",text:QUESTIONS[next].ask}]); setQIndex(next); }
  }

  async function generateTrip() {
    setLoading(true); setTab("stops");
    await new Promise(r=>setTimeout(r,1800));
    setStops(STOPS_DATA); setLoading(false); setGenerated(true);
    toast_("Trip planned");
  }

  function resetPlan() {
    setConvo([]); setAnswers({}); setQIndex(-1);
    setConvoComplete(false); setGenerated(false); setStops([]);
  }

  const currentQ = qIndex>=0 ? QUESTIONS[qIndex] : null;

  function SummaryCard() {
    const rows=[
      ["Vehicle",answers.vehicle],
      answers.trailer_detail&&["Trailer",answers.trailer_detail],
      ["Fuel",answers.fuel],
      ["Pets",answers.pets==="Yes"?`Yes — ${answers.pet_desc||""}`:"No"],
      ["Lodging",answers.lodging],
      ["Restaurants",answers.restaurants],
      ["Grocery",answers.grocery],
      answers.extra&&answers.extra!=="skip"&&["Notes",answers.extra],
    ].filter(Boolean);
    return (
      <div className="summary-card">
        {rows.map(([k,v])=>(
          <div className="summary-row" key={k}>
            <div className="summary-key">{k}</div>
            <div>{v}</div>
          </div>
        ))}
      </div>
    );
  }

  const planPanel = (
    <div className="chat-wrap">
      <div className="chat-header">
        <div className="chat-title">Plan your trip.</div>
        <div className="chat-sub">Answer a few quick questions and we'll handle everything.</div>
      </div>
      <div className="route-wrap">
        <div className="route-input-wrap">
          <div className="route-dot"/>
          <input className="route-input" placeholder="Starting from…" value={origin} onChange={e=>setOrigin(e.target.value)}/>
        </div>
        <div className="route-line"/>
        <div className="route-input-wrap">
          <div className="route-dot dest"/>
          <input className="route-input" placeholder="Going to…" value={dest} onChange={e=>setDest(e.target.value)}/>
        </div>
      </div>
      <div className="convo-wrap">
        {qIndex===-1&&convo.length===0&&(
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}>Enter your route above, then tap below to get started.</div>
            <button className="btn-generate" style={{width:"auto",padding:"10px 28px",display:"inline-block"}} onClick={startConvo}>Start planning</button>
          </div>
        )}
        {convo.map((msg,i)=>(
          msg.role==="ai"?(
            <div className="ai-msg" key={i}>
              {i===0&&<div className="ai-name">TripMappa</div>}
              <div className="ai-bubble">{msg.text}</div>
            </div>
          ):(
            <div className="user-msg" key={i}>
              <div className="user-bubble">{msg.text}</div>
            </div>
          )
        ))}
        {currentQ&&(
          <div className="ai-msg">
            {currentQ.type==="yesno"&&(
              <div className="quick-replies">
                <button className="qr-btn yes" onClick={()=>submitAnswer("Yes")}>Yes</button>
                <button className="qr-btn no" onClick={()=>submitAnswer("No")}>No</button>
              </div>
            )}
            {currentQ.type==="choice"&&(
              <div className="quick-replies">
                {currentQ.choices.map(c=><button key={c} className="qr-btn" onClick={()=>submitAnswer(c)}>{c}</button>)}
              </div>
            )}
            {currentQ.type==="text"&&(
              <div className="answer-input-wrap">
                <input className="answer-input" placeholder={currentQ.placeholder} value={textInput} onChange={e=>setTextInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&textInput.trim()&&submitAnswer(textInput.trim())}/>
                {currentQ.skippable&&<button className="answer-send" style={{background:"var(--surface)",color:"var(--muted)",border:"1px solid var(--border)"}} onClick={()=>submitAnswer("skip")}>Skip</button>}
                <button className="answer-send" onClick={()=>textInput.trim()&&submitAnswer(textInput.trim())}>Send</button>
              </div>
            )}
          </div>
        )}
        {convoComplete&&<div className="ai-msg"><SummaryCard/></div>}
        <div ref={convoEndRef}/>
      </div>
      {convoComplete&&(
        <div className="generate-wrap">
          <button className="btn-generate" onClick={generateTrip} disabled={loading}>
            {loading?<><span className="spinner"/>Planning your trip…</>:"Generate Trip Plan"}
          </button>
        </div>
      )}
    </div>
  );

  const StopsPanel = ()=>(
    <div className="stops-wrap">
      {!generated?(
        <div className="empty-state">
          <div className="empty-title">No trip yet</div>
          <div className="empty-sub">Go to Plan, answer the questions,<br/>and hit Generate Trip Plan.</div>
        </div>
      ):(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"Syne",fontWeight:700,fontSize:15}}>{origin} → {dest}</div>
            <button className="action-btn" style={{flex:"none",padding:"5px 12px",fontSize:11}} onClick={resetPlan}>Edit trip</button>
          </div>
          <div className="section-sep"/>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--muted)",marginBottom:8}}>Overnight stops</div>
          {stops.map((stop,i)=>(
            <div className="stop-card" key={i} style={{animationDelay:i*0.07+"s"}}>
              <div className="stop-card-head">
                <div className="stop-num">{i+1}</div>
                <div>
                  <div className="stop-city">{stop.city}</div>
                  <div className="stop-meta">{stop.distance} · {stop.eta} drive</div>
                </div>
              </div>
              <div className="stop-body">
                <div className="stop-section-label">Hotels</div>
                {stop.hotels.map((h,hi)=>(
                  <div className="item-row" key={hi} onClick={()=>toast_(`Booking ${h.name}`)}>
                    <div className="item-info">
                      <div className="item-name">{h.name}</div>
                      <div className="item-meta">{h.stars}-star{h.pet?" · Pet-friendly":""}</div>
                    </div>
                    <div className="item-price">{h.price}</div>
                  </div>
                ))}
                {answers.restaurants==="Yes"&&(
                  <>
                    <div className="stop-section-label">Restaurants</div>
                    {stop.restaurants.map((r,ri)=>(
                      <div className="item-row" key={ri} onClick={()=>toast_(`Booking ${r.name}`)}>
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
                  <button className="action-btn action-btn-primary" onClick={()=>toast_("Hotel reserved!")}>Reserve hotel</button>
                  {answers.grocery==="Yes"&&<button className="action-btn" onClick={()=>setModal({type:"grocery",city:stop.city})}>Grocery</button>}
                  <button className="action-btn" onClick={()=>toast_("Added to map")}>Map</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const SharePanel = ()=>(
    <div className="share-wrap">
      <div className="share-title">Live sharing</div>
      <div className="share-sub">Share your location in real time. Friends and family get a live map link — no app needed.</div>
      {[{init:"S",name:"Sarah",status:"live"},{init:"M",name:"Mom",status:"pending"}].map((p,i)=>(
        <div className="person-row" key={i}>
          <div className="avatar">{p.init}</div>
          <div style={{flex:1}}>
            <div className="person-name">{p.name}</div>
            <div className="person-status"><span className={"dot dot-"+(p.status==="live"?"live":"pending")}/>{p.status==="live"?"Watching live":"Invite pending"}</div>
          </div>
        </div>
      ))}
      <button className="btn-generate" style={{marginTop:16}} onClick={()=>toast_("Link copied")}>Copy share link</button>
    </div>
  );

  const GroceryModal = ({city})=>(
    <div className="modal">
      <div className="modal-title">Grocery delivery</div>
      <div className="modal-sub">Delivered to your hotel in {city}</div>
      <div className="grocery-input-row">
        <input className="grocery-input" placeholder="Add item…" value={groceryInput} onChange={e=>setGroceryInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&groceryInput.trim()&&(setGroceryItems(g=>[...g,groceryInput.trim()]),setGroceryInput(""))}/>
        <button className="modal-btn modal-btn-primary" style={{flex:"none",padding:"0 14px",borderRadius:7}} onClick={()=>groceryInput.trim()&&(setGroceryItems(g=>[...g,groceryInput.trim()]),setGroceryInput(""))}>Add</button>
      </div>
      <ul className="grocery-list">
        {groceryItems.length===0&&<li style={{color:"var(--muted)",fontSize:12,padding:"8px 0"}}>No items yet</li>}
        {groceryItems.map((item,i)=><li className="grocery-item" key={i}>{item}</li>)}
      </ul>
      <div className="modal-footer">
        <button className="modal-btn modal-btn-outline" onClick={()=>setModal(null)}>Cancel</button>
        <button className="modal-btn modal-btn-primary" onClick={()=>{toast_("Grocery order placed");setModal(null);}}>Place order</button>
      </div>
    </div>
  );

  if (view === "hero") return (
    <>
      <style>{CSS}</style>

      {/* Nav */}
      <nav className={`nav ${scrolled?"solid":"transparent"}`}>
        <div className="nav-logo">Trip<span>Mappa</span></div>
        <div className="nav-right">
          <div className="theme-switch" onClick={()=>setHeroTheme(t=>t==="day"?"night":"day")}>
            <div className={`theme-switch-track ${heroTheme}`}>
              <div className={`theme-switch-thumb ${heroTheme}`}>
                {heroTheme === "day" ? "☀️" : "🌙"}
              </div>
            </div>
          </div>
          <button className="nav-btn" onClick={()=>setView("app")}>Log in</button>
          <button className="nav-btn nav-btn-primary" onClick={()=>setView("app")}>Sign up</button>
        </div>
      </nav>

      {/* Hero */}
      <div className={`hero ${heroTheme}`}>
        {/* Day background layer */}
        <div style={{
          position:"absolute", inset:0, zIndex:0, pointerEvents:"none",
          background:"linear-gradient(180deg,#87CEEB 0%,#a8d8ea 18%,#c8e8c0 38%,#a8c878 52%,#8ab560 62%,#6d9e4a 72%,#4a7a6a 82%,#2d5a52 92%,#1a3d38 100%)",
          opacity: heroTheme === "day" ? 1 : 0,
          transition: "opacity 1.8s ease",
        }}/>
        {/* Night background layer */}
        <div style={{
          position:"absolute", inset:0, zIndex:0, pointerEvents:"none",
          background:"linear-gradient(180deg,#020818 0%,#050d2a 20%,#0a1840 40%,#0d2255 55%,#1a3a6a 65%,#3a2a15 78%,#6b3d10 88%,#8a5020 95%,#020818 100%)",
          opacity: heroTheme === "night" ? 1 : 0,
          transition: "opacity 1.8s ease",
        }}/>
        {heroTheme === "night" && <Stars/>}
        <div className="hero-glow" style={{
          background: heroTheme === "night"
            ? "radial-gradient(ellipse at center bottom, rgba(220,120,40,0.5) 0%, rgba(180,80,20,0.25) 45%, transparent 75%)"
            : "radial-gradient(ellipse at center, rgba(150,210,200,0.35) 0%, rgba(100,180,170,0.15) 50%, transparent 80%)",
          opacity: 1,
          transition: "opacity 1.8s ease",
        }}/>

        {/* Day: River SVG / Night: Road SVG */}
        <div style={{opacity: heroTheme==="day"?1:0, transition:"opacity 1.8s ease", position:"absolute", inset:0, zIndex:1, pointerEvents:"none"}}>
          <svg className="hero-road-svg" viewBox="0 0 900 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M200 400 Q300 300 250 200 Q200 100 350 50 Q450 20 500 0" stroke="rgba(100,180,200,0.5)" strokeWidth="60" fill="none" strokeLinecap="round"/>
            <path d="M200 400 Q300 300 250 200 Q200 100 350 50 Q450 20 500 0" stroke="rgba(150,210,220,0.3)" strokeWidth="80" fill="none" strokeLinecap="round"/>
            <path d="M0 320 Q200 280 400 320 Q600 360 900 300" stroke="rgba(100,160,80,0.15)" strokeWidth="2" fill="none"/>
            <path d="M0 350 Q250 310 500 350 Q700 380 900 340" stroke="rgba(100,160,80,0.12)" strokeWidth="2" fill="none"/>
          </svg>
        </div>
        <div style={{opacity: heroTheme==="night"?1:0, transition:"opacity 1.8s ease", position:"absolute", inset:0, zIndex:1, pointerEvents:"none"}}>
          <svg className="hero-road-svg" viewBox="0 0 900 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M450 400 L200 0" stroke="white" strokeWidth="80" strokeOpacity="0.05"/>
            <path d="M450 400 L700 0" stroke="white" strokeWidth="80" strokeOpacity="0.05"/>
            <path d="M450 400 L450 0" stroke="white" strokeWidth="5" strokeOpacity="0.12" strokeDasharray="30 20"/>
            <path d="M450 400 L200 0" stroke="white" strokeWidth="1.5" strokeOpacity="0.15"/>
            <path d="M450 400 L700 0" stroke="white" strokeWidth="1.5" strokeOpacity="0.15"/>
          </svg>
        </div>

        {/* Day/Night Toggle removed — now in nav */}

        <div className="hero-content">
          <div className="hero-eyebrow">TripMappa</div>

          <h1 className="hero-title">
            Travel<br/>
            <span className="highlight">Reimagined.</span>
          </h1>

          <p className="hero-sub">Your next trip, planned in seconds.</p>

          {/* Search bar */}
          <div className="hero-search">
            <div className="hero-input-wrap">
              <div className="hero-input-label">From</div>
              <input className="hero-input" placeholder="Dallas, TX" value={heroOrigin} onChange={e=>setHeroOrigin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&launchFromHero()}/>
            </div>
            <div className="hero-search-divider"/>
            <div className="hero-input-wrap">
              <div className="hero-input-label">To</div>
              <input className="hero-input" placeholder="Los Angeles, CA" value={heroDest} onChange={e=>setHeroDest(e.target.value)} onKeyDown={e=>e.key==="Enter"&&launchFromHero()}/>
            </div>
            <button className="hero-go-btn" onClick={launchFromHero}>Plan my trip →</button>
          </div>

          {/* Social sign in */}
          <div className="hero-auth">
            <div className="hero-auth-label">Sign up with</div>
            <div className="hero-auth-btns">
              <button className="hero-auth-btn" onClick={()=>setView("app")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </button>
              <button className="hero-auth-btn" onClick={()=>setView("app")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </button>
              <button className="hero-auth-btn" onClick={()=>setView("app")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Apple
              </button>
            </div>
          </div>

          <div className="hero-pills">
            {["Flights","Hotels","Restaurants","Fuel & EV stops","Live location sharing","Truck & RV routing","Grocery delivery"].map(p=>(
              <div key={p} className="hero-pill">{p}</div>
            ))}
          </div>
        </div>

        <div className="scroll-indicator">
          <div className="scroll-arrow"/>
        </div>
      </div>

      {toast&&<div className="toast">{toast}</div>}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <nav className="nav solid">
        <div className="nav-logo">Trip<span>Mappa</span></div>
        <div className="nav-center">
          {[["plan","Plan"],["stops","Stops"],["share","Share"]].map(([k,l])=>(
            <button key={k} className={"nav-tab"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="nav-right">
          <button className="nav-btn" onClick={()=>toast_("Trip saved")}>Save trip</button>
          <button className="nav-btn nav-btn-primary" onClick={()=>toast_("Link copied")}>Share</button>
        </div>
      </nav>

      <div className="app">
        <div className="sidebar">
          {tab==="plan"&&planPanel}
          {tab==="stops"&&<StopsPanel/>}
          {tab==="share"&&<SharePanel/>}
        </div>
        <div className="map-area">
          <div className="map-placeholder">
            <div className="map-placeholder-text">{generated?`${origin} → ${dest}`:"Your route will appear here"}</div>
            <div className="map-placeholder-sub">{generated?`${stops.length} stops · Real map coming in Phase 2`:"Plan your trip to get started"}</div>
          </div>
        </div>
      </div>

      {modal?.type==="grocery"&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <GroceryModal city={modal.city}/>
        </div>
      )}
      {toast&&<div className="toast">{toast}</div>}
    </>
  );
}
