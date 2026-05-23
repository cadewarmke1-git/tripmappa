import { useState, useRef, useEffect, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const GOOGLE_LIBRARIES = ["places", "routes"];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800;900&display=swap');
  :root {
    --ink: #0a0c10;
    --surface: #f4f1ec;
    --card: #ffffff;
    --accent: #e05c2a;
    --accent2: #2a7ae0;
    --accent3: #2abf6e;
    --muted: #9a9590;
    --border: #e2ddd7;
    --nav-h: 64px;
    --r: 14px;
    --sidebar-w: 380px;
    --shadow-sm: 0 1px 4px rgba(0,0,0,0.06);
    --shadow: 0 2px 16px rgba(0,0,0,0.08);
    --shadow-lg: 0 8px 40px rgba(0,0,0,0.14);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: var(--surface); color: var(--ink); min-height: 100vh; font-size: 14px; -webkit-font-smoothing: antialiased; letter-spacing: -0.01em; }

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
  .nav-logo { font-family: 'Syne', sans-serif; font-size: 21px; font-weight: 900; letter-spacing: -0.8px; }
  .nav.transparent .nav-logo { color: #fff; }
  .nav.solid .nav-logo { color: var(--ink); }
  .nav.transparent .nav-logo span { color: rgba(255,210,140,0.9); }
  .nav.solid .nav-logo span { color: rgba(255,210,140,0.9); }
  .nav-center { display: flex; gap: 1px; border-radius: 8px; padding: 3px; }
  .nav.transparent .nav-center { background: rgba(255,255,255,0.12); }
  .nav.solid .nav-center { background: var(--border); }
  .nav-tab { background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 500; padding: 5px 14px; border-radius: 6px; transition: all 0.15s; }
  .nav.transparent .nav-tab { color: rgba(255,255,255,0.65); }
  .nav.transparent .nav-tab:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .nav.transparent .nav-tab.active { background: rgba(255,255,255,0.2); color: #fff; font-weight: 600; }
  .nav.solid .nav-tab { color: var(--muted); }
  .nav.solid .nav-tab:hover { color: var(--ink); }
  .nav.solid .nav-tab.active { background: #fff; color: var(--ink); font-weight: 600; box-shadow: var(--shadow-sm); }
  .nav-right { display: flex; gap: 8px; }
  .nav-btn { border: 1px solid; cursor: pointer; border-radius: 7px; padding: 6px 14px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; transition: all 0.15s; }
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
    animation: twinkle var(--dur) ease-in-out infinite alternate, drift var(--drift) ease-in-out infinite;
  }
  @keyframes twinkle { from { opacity: var(--lo); } to { opacity: var(--hi); } }
  @keyframes drift {
    0% { transform: translate(0px, 0px); }
    33% { transform: translate(2px, -3px); }
    66% { transform: translate(-2px, -4px); }
    100% { transform: translate(0px, 0px); }
  }

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
    font-size: clamp(40px, 7.5vw, 92px);
    line-height: 0.95; letter-spacing: -3px;
    color: #fff; margin-bottom: 20px;
    text-shadow: 0 2px 30px rgba(0,0,0,0.15);
  }
  .hero-title .highlight {
    background: linear-gradient(135deg, #ffd060, #f09020);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-size: 15px; color: rgba(255,255,255,0.65); max-width: 420px;
    margin: 0 auto 36px; line-height: 1.6; font-weight: 400; letter-spacing: -0.01em;
  }

  /* Hero search bar */
  .hero-search {
    background: rgba(255,255,255,0.98);
    border-radius: 18px; padding: 8px 8px 8px 22px;
    display: flex; align-items: center; gap: 14px;
    width: 100%; max-width: 580px; margin: 0 auto 24px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.15);
    animation: heroIn 1s 0.2s cubic-bezier(0.16,1,0.3,1) both;
  }
  @media (max-width: 540px) {
    .hero-search { flex-direction: column; padding: 16px; border-radius: 16px; gap: 10px; }
    .hero-search-divider { width: 100%; height: 1px; }
    .hero-input-wrap { width: 100%; }
    .hero-go-btn { width: 100%; text-align: center; justify-content: center; }
    .hero-title { letter-spacing: -1.5px; }
    .hero-auth-btns { flex-wrap: wrap; }
  }
  .hero-search-divider { width: 1px; height: 30px; background: #e2ddd7; flex-shrink: 0; }
  .hero-input-wrap { flex: 1; display: flex; flex-direction: column; }
  .hero-input-label { font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #b8b0a8; margin-bottom: 3px; }
  .hero-input {
    border: none; outline: none; font-family: 'DM Sans', sans-serif;
    font-size: 15px; font-weight: 500; color: var(--ink);
    background: transparent; width: 100%; padding: 0; letter-spacing: -0.01em;
  }
  .hero-input::placeholder { color: #c0b8b0; font-weight: 400; }
  .hero-go-btn {
    background: var(--ink);
    color: #fff; border: none; border-radius: 12px;
    padding: 13px 24px; font-family: 'Syne', sans-serif;
    font-size: 14px; font-weight: 800; cursor: pointer;
    transition: transform 0.15s, background 0.15s; white-space: nowrap;
    flex-shrink: 0; letter-spacing: -0.2px;
  }
  .hero-go-btn:hover { transform: translateY(-1px); background: #1a1a1a; }
  .hero-go-btn:active { transform: translateY(0); }

  .hero-hint {
    font-size: 12px; color: rgba(255,255,255,0.4);
    animation: heroIn 1s 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }
  .hero-hint span { color: rgba(255,210,140,0.7); }

  /* Auth buttons */
  .hero-auth { margin-bottom: 28px; animation: heroIn 1s 0.35s cubic-bezier(0.16,1,0.3,1) both; }
  .hero-auth-label { font-size: 10px; color: rgba(255,255,255,0.35); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; font-weight: 600; }
  .hero-auth-btns { display: flex; gap: 8px; justify-content: center; }
  .hero-auth-btn { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.96); border: none; border-radius: 11px; padding: 10px 20px; font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 600; color: var(--ink); cursor: pointer; transition: all 0.15s; box-shadow: 0 2px 8px rgba(0,0,0,0.12); letter-spacing: -0.01em; }
  .hero-auth-btn:hover { background: #fff; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.16); }

  /* Feature pills */
  .hero-pills {
    display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
    margin-top: 48px;
    animation: heroIn 1s 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }
  .hero-pill {
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 99px; padding: 6px 14px;
    font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.6);
    pointer-events: none; user-select: none;
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

  .pac-container {
    z-index: 99999 !important;
    border-radius: 14px !important;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06) !important;
    border: 1.5px solid var(--border) !important;
    font-family: 'DM Sans', sans-serif !important;
    margin-top: 6px !important;
    overflow: hidden !important;
  }
  .pac-item {
    padding: 10px 16px !important;
    font-size: 13.5px !important;
    cursor: pointer !important;
    border-top: 1px solid var(--border) !important;
  }
  .pac-item:first-child { border-top: none !important; }
  .pac-item:hover { background: var(--surface) !important; }
  .pac-item-query { font-weight: 600 !important; color: var(--ink) !important; }
  .pac-matched { font-weight: 700 !important; color: var(--accent) !important; }
  .map-area { flex: 1; position: relative; overflow: hidden; }
  .gmap-wrap { width: 100%; height: 100%; }
  .map-loading { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e8eff5; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #888; }
  .route-info-bar {
    position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: rgba(10,12,16,0.88); backdrop-filter: blur(16px) saturate(1.5);
    border-radius: 14px; padding: 12px 22px;
    display: flex; gap: 20px; align-items: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.08);
    z-index: 10; white-space: nowrap;
  }
  .route-info-bar .rib-item { text-align: center; }
  .route-info-bar .rib-val { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.3px; }
  .route-info-bar .rib-label { font-size: 9px; color: rgba(255,255,255,0.4); letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  /* ── App layout — full screen map with floating card ── */
  .app { padding-top: var(--nav-h); position: relative; height: 100vh; }
  .map-full { position: absolute; inset: 0; top: var(--nav-h); }
  .gmap-wrap { width: 100%; height: 100%; }

  /* Floating card */
  .float-card {
    position: absolute; top: calc(var(--nav-h) + 16px); left: 16px;
    width: 370px; max-height: calc(100vh - var(--nav-h) - 32px);
    background: rgba(255,255,255,0.96); backdrop-filter: blur(24px) saturate(1.8);
    border-radius: 20px; border: 1px solid rgba(255,255,255,0.8);
    box-shadow: 0 4px 24px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04);
    display: flex; flex-direction: column;
    overflow: hidden; z-index: 50;
    transition: transform 0.45s cubic-bezier(0.34,1.2,0.64,1), opacity 0.3s ease;
  }
  .float-card.night {
    background: rgba(8,14,38,0.92); border-color: rgba(255,255,255,0.08);
    box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3);
  }
  .float-card.collapsed { max-height: 62px; overflow: hidden; }
  .float-card-scroll { overflow-y: auto; flex: 1; }
  .float-card-scroll::-webkit-scrollbar { width: 0; }

  /* Mobile responsive */
  @media (max-width: 600px) {
    .float-card {
      left: 8px; right: 8px; width: calc(100vw - 16px);
      top: calc(var(--nav-h) + 8px);
      max-height: calc(100vh - var(--nav-h) - 16px);
      border-radius: 16px;
    }
    .chat-title { font-size: 18px !important; }
    .chat-header { padding: 16px 16px 12px !important; }
    .route-wrap { padding: 12px 16px !important; }
    .convo-wrap { padding: 12px 14px !important; }
    .generate-wrap { padding: 10px 14px 14px !important; }
    .stops-wrap { padding: 12px 12px 20px !important; }
  }

  /* Card header */
  .float-card-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px; cursor: pointer; user-select: none;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    flex-shrink: 0;
  }
  .float-card.night .float-card-header { border-bottom-color: rgba(255,255,255,0.06); }
  .float-card-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.2px; }
  .float-card.night .float-card-title { color: #fff; }
  .float-card-chevron { font-size: 10px; color: var(--muted); transition: transform 0.3s; }
  .float-card-chevron.open { transform: rotate(180deg); }

  /* Map placeholder */
  .map-placeholder { width: 100%; height: 100%; background: linear-gradient(150deg, #e4eef5 0%, #d2e4f0 60%, #c0d6e8 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; }
  .map-placeholder-text { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: rgba(0,0,0,0.18); }
  .map-placeholder-sub { font-size: 12px; color: rgba(0,0,0,0.12); }

  /* ── Chat panel ── */
  .chat-wrap { display: flex; flex-direction: column; height: 100%; }
  .chat-header { padding: 22px 20px 16px; border-bottom: 1px solid var(--border); }
  .chat-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 900; color: var(--ink); margin-bottom: 4px; letter-spacing: -0.5px; line-height: 1.2; }
  .chat-sub { font-size: 13px; color: var(--muted); line-height: 1.5; }
  .route-wrap { padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
  .route-input-wrap { position: relative; }
  .route-dot { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 7px; height: 7px; border-radius: 50%; background: var(--ink); }
  .route-dot.dest { background: var(--accent); }
  .route-input { width: 100%; padding: 11px 12px 11px 32px; border: 1.5px solid var(--border); border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; background: var(--surface); color: var(--ink); outline: none; transition: all 0.15s; }
  .route-input:focus { border-color: var(--ink); background: #fff; box-shadow: 0 0 0 3px rgba(10,12,16,0.06); }
  .route-input::placeholder { color: #c0bab4; }
  .route-line { width: 1.5px; height: 10px; background: var(--border); margin-left: 16px; }
  .convo-wrap { flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 24px; }
  .convo-wrap::-webkit-scrollbar { width: 0px; }
  .ai-msg { display: flex; flex-direction: column; gap: 10px; animation: fadeUp 0.2s ease both; padding-bottom: 4px; }
  .quick-replies { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; }
  @keyframes slideUp { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
  @keyframes fadeOut { from { opacity:1; } to { opacity:0; } }
  .results-view { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .plan-view { animation: fadeUp 0.2s ease both; }
  .ai-bubble { background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px 14px 14px 4px; padding: 12px 16px; font-size: 14px; line-height: 1.6; color: var(--ink); max-width: 94%; }
  .ai-name { font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
  .user-msg { display: flex; justify-content: flex-end; animation: fadeUp 0.2s ease both; }
  .user-bubble { background: var(--ink); color: #fff; border-radius: 14px 14px 4px 14px; padding: 10px 16px; font-size: 14px; max-width: 80%; line-height: 1.5; }
  .quick-replies { display: flex; flex-wrap: wrap; gap: 6px; }
  .qr-btn { border: 1.5px solid var(--border); background: #fff; border-radius: 99px; padding: 7px 16px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.14s; color: var(--ink); letter-spacing: -0.01em; }
  .qr-btn:hover { border-color: var(--ink); background: var(--surface); }
  .qr-btn.yes { border-color: var(--accent3); color: var(--accent3); }
  .qr-btn.yes:hover { background: var(--accent3); color: #fff; }
  .qr-btn.no { border-color: var(--accent); color: var(--accent); }
  .qr-btn.no:hover { background: var(--accent); color: #fff; }
  .answer-input-wrap { display: flex; gap: 7px; }
  .answer-input { flex: 1; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: 99px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: all 0.15s; background: #fff; }
  .answer-input:focus { border-color: var(--ink); }
  .answer-send { background: var(--ink); color: #fff; border: none; border-radius: 99px; padding: 10px 18px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.14s; white-space: nowrap; }
  .answer-send:hover { background: #1a1a1a; }
  .summary-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.7; }
  .summary-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 7px; }
  .summary-key { font-weight: 600; min-width: 84px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding-top: 2px; }
  .generate-wrap { padding: 12px 18px 18px; border-top: 1px solid var(--border); }
  .btn-generate { width: 100%; padding: 13px; border: none; cursor: pointer; background: var(--ink); color: #fff; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; transition: background 0.15s, transform 0.12s; letter-spacing: -0.01em; }
  .btn-generate:hover { background: #1a1a1a; transform: translateY(-1px); }
  .btn-generate:active { transform: translateY(0); }
  .btn-generate:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  .spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Stops panel ── */
  .stops-wrap { padding: 16px 16px 24px; }
  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.3px; }
  .empty-sub { font-size: 13px; color: var(--muted); line-height: 1.6; }
  .stop-card { background: #fff; border: 1.5px solid var(--border); border-radius: var(--r); margin-bottom: 10px; overflow: hidden; animation: fadeUp 0.25s ease both; transition: box-shadow 0.2s; }
  .stop-card:hover { box-shadow: var(--shadow); }
  .stop-card-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1.5px solid var(--border); background: var(--surface); }
  .stop-num { width: 26px; height: 26px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: 'Syne', sans-serif; }
  .stop-city { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800; letter-spacing: -0.2px; }
  .stop-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
  .stop-body { padding: 14px; }
  .stop-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 8px; margin-top: 12px; }
  .stop-section-label:first-child { margin-top: 0; }
  .item-row { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 9px; cursor: pointer; transition: background 0.12s; margin-bottom: 4px; border: 1.5px solid var(--border); background: var(--surface); }
  .item-row:hover { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.12); }
  .item-info { flex: 1; }
  .item-name { font-size: 13.5px; font-weight: 600; }
  .item-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
  .item-price { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 800; flex-shrink: 0; }
  .item-time { font-size: 11.5px; font-weight: 600; color: var(--accent2); flex-shrink: 0; }
  .stop-actions { display: flex; gap: 7px; margin-top: 12px; }
  .action-btn { flex: 1; padding: 8px 0; border-radius: 9px; border: 1.5px solid var(--border); background: var(--surface); font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--ink); transition: all 0.14s; }
  .action-btn:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.15); }
  .action-btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); }
  .action-btn-primary:hover { background: #1a1a1a; border-color: #1a1a1a; }
  .section-sep { height: 1px; background: var(--border); margin: 6px 0 14px; }

  /* ── Share panel ── */
  .share-wrap { padding: 22px 18px; }
  .share-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 900; margin-bottom: 5px; letter-spacing: -0.3px; }
  .share-sub { font-size: 13px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
  .person-row { display: flex; align-items: center; gap: 12px; padding: 11px 13px; border-radius: 10px; margin-bottom: 8px; background: var(--surface); border: 1.5px solid var(--border); }
  .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: 'Syne', sans-serif; }
  .person-name { font-size: 13.5px; font-weight: 600; }
  .person-status { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 5px; margin-top: 2px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .dot-live { background: var(--accent3); }
  .dot-pending { background: #f5a623; }

  /* ── Modal ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
  .modal { background: #fff; border-radius: 20px; padding: 24px; max-width: 360px; width: 100%; box-shadow: var(--shadow-lg); }
  .modal-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.3px; }
  .modal-sub { font-size: 13px; color: var(--muted); margin-bottom: 18px; }
  .grocery-list { list-style: none; margin-bottom: 12px; max-height: 160px; overflow-y: auto; }
  .grocery-item { padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; }
  .grocery-item:last-child { border-bottom: none; }
  .grocery-input-row { display: flex; gap: 7px; margin-bottom: 14px; }
  .grocery-input { flex: 1; padding: 9px 13px; border: 1.5px solid var(--border); border-radius: 9px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; }
  .grocery-input:focus { border-color: var(--ink); }
  .modal-footer { display: flex; gap: 8px; }
  .modal-btn { flex: 1; padding: 11px; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; }
  .modal-btn-primary { background: var(--ink); color: #fff; }
  .modal-btn-outline { background: var(--surface); color: var(--ink); border: 1.5px solid var(--border); }

  /* ── Toast ── */
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 300; background: var(--ink); color: #fff; padding: 11px 20px; border-radius: 99px; font-size: 13.5px; font-weight: 500; box-shadow: 0 4px 20px rgba(0,0,0,0.25); animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1); white-space: nowrap; letter-spacing: -0.01em; border: 1px solid rgba(255,255,255,0.08); }
  @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
`;

const QUESTIONS = [
  {
    id: "trip_type",
    ask: "What kind of trip is this?",
    type: "choice",
    choices: ["Road trip", "Driving home", "Day trip", "Work / Delivery"],
  },
  {
    id: "vehicle",
    ask: "What are you traveling in?",
    type: "choice",
    choices: ["Car", "RV / Camper", "Semi Truck", "Motorcycle", "Trailer"],
  },
  {
    id: "trailer_detail",
    ask: "What's the trailer weight and length?",
    type: "text",
    placeholder: "e.g. 14,000 lbs, 40 ft",
    onlyIf: (a) => a.vehicle === "Trailer" || a.vehicle === "Semi Truck",
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
    onlyIf: (a) => a.trip_type !== "Work / Delivery",
  },
  {
    id: "pet_desc",
    ask: "Tell us about your pet — type and size.",
    type: "text",
    placeholder: "e.g. large golden retriever",
    onlyIf: (a) => a.pets === "Yes",
  },
  {
    id: "overnight",
    ask: "Will you need overnight stops?",
    type: "yesno",
    onlyIf: (a) => a.trip_type === "Road trip" || a.trip_type === "Work / Delivery",
  },
  {
    id: "lodging",
    ask: "What kind of lodging do you prefer?",
    type: "choice",
    choices: ["Budget", "Mid-range", "Upscale", "Luxury", "Campground", "RV Park"],
    onlyIf: (a) => a.overnight === "Yes" || a.trip_type === "Road trip" && a.overnight !== "No",
  },
  {
    id: "restaurants",
    ask: "Want restaurant recommendations at each stop?",
    type: "yesno",
    onlyIf: (a) => a.overnight === "Yes" || a.trip_type === "Road trip",
  },
  {
    id: "grocery",
    ask: "Would you like grocery delivery to your hotel?",
    type: "yesno",
    onlyIf: (a) => a.overnight === "Yes" && a.lodging !== "Campground" && a.lodging !== "RV Park",
  },
  {
    id: "extra",
    ask: "Anything else we should know? (optional)",
    type: "text",
    placeholder: "e.g. need wide parking, traveling with kids…",
    skippable: true,
    onlyIf: (a) => a.trip_type !== "Driving home" && a.trip_type !== "Day trip",
  },
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
// Stars generated once outside component so they never rerender
const STAR_DATA = Array.from({length:80},(_,i)=>({
  id:i, top:`${Math.random()*65}%`, left:`${Math.random()*100}%`,
  size: Math.random()<0.3 ? 2.5 : Math.random()<0.6 ? 1.5 : 1,
  lo: (Math.random()*0.2+0.1).toFixed(2), hi: (Math.random()*0.6+0.4).toFixed(2),
  dur: `${(Math.random()*3+2).toFixed(1)}s`,
  drift: `${(Math.random()*12+8).toFixed(1)}s`,
}));

function Stars() {
  return (
    <div className="hero-stars">
      {STAR_DATA.map(s=>(
        <div key={s.id} className="star" style={{
          top:s.top, left:s.left, width:s.size, height:s.size,
          '--lo':s.lo, '--hi':s.hi, '--dur':s.dur, '--drift':s.drift,
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
  const [tripTips, setTripTips] = useState([]);
  const [roadStops, setRoadStops] = useState([]);
  const [stopCategory, setStopCategory] = useState("all");
  const [savedTrips, setSavedTrips] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tripmappa-saved") || "[]"); } catch { return []; }
  });

  function saveTrip() {
    if (!origin || !dest || !stops.length) return;
    const trip = {
      id: Date.now(),
      origin, dest,
      date: new Date().toLocaleDateString(),
      stops, tripTips, answers, routeInfo,
    };
    const updated = [trip, ...savedTrips];
    setSavedTrips(updated);
    try { localStorage.setItem("tripmappa-saved", JSON.stringify(updated)); } catch {}
    toast_("Trip saved");
  }

  function deleteSavedTrip(id) {
    const updated = savedTrips.filter(t => t.id !== id);
    setSavedTrips(updated);
    try { localStorage.setItem("tripmappa-saved", JSON.stringify(updated)); } catch {}
    toast_("Trip removed");
  }
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [groceryInput, setGroceryInput] = useState("");
  const [groceryItems, setGroceryItems] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [heroTheme, setHeroTheme] = useState("day");
  const [cardCollapsed, setCardCollapsed] = useState(false);

  // ── Google Maps ──
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: GOOGLE_LIBRARIES,
  });
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 37.0902, lng: -95.7129 });
  const originRef = useRef(null);
  const destRef = useRef(null);
  const heroOriginRef = useRef(null);
  const heroDestRef = useRef(null);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);

  const fetchDirections = useCallback((vehicleType, trailerDetail) => {
    const originVal = originRef.current?.value;
    const destVal = destRef.current?.value;
    if (!originVal || !destVal) return;

    // Build route request based on vehicle type
    const routeRequest = {
      origin: originVal,
      destination: destVal,
      travelMode: window.google.maps.TravelMode.DRIVING,
    };

    // For trucks and trailers avoid highways with restrictions
    if (vehicleType === "Semi Truck" || vehicleType === "Trailer") {
      routeRequest.avoidFerries = true;
      routeRequest.avoidTolls = false;
      // Use alternative routes to find truck-safe paths
      routeRequest.provideRouteAlternatives = true;
    }

    if (vehicleType === "RV / Camper") {
      routeRequest.avoidFerries = true;
      routeRequest.provideRouteAlternatives = true;
    }

    const service = new window.google.maps.DirectionsService();
    service.route(routeRequest, (result, status) => {
      if (status === "OK") {
        const leg = result.routes[0].legs[0];
        setRouteInfo({
          distance: leg.distance.text,
          duration: leg.duration.text,
          start: leg.start_address.split(",")[0],
          end: leg.end_address.split(",")[0],
          vehicleType: vehicleType || "Car",
          trailerDetail: trailerDetail || null,
        });
        setOrigin(originVal);
        setDest(destVal);
        setRoutePath(result.routes[0].overview_path);

        if (mapRef.current) {
          const bounds = new window.google.maps.LatLngBounds();
          result.routes[0].legs[0].steps.forEach(step => {
            bounds.extend(step.start_location);
            bounds.extend(step.end_location);
          });
          mapRef.current.fitBounds(bounds, { padding: 60 });
        }
      }
    });
  }, []);

  const convoEndRef = useRef(null);
  useEffect(()=>{ convoEndRef.current?.scrollIntoView({behavior:"smooth"}); },[convo]);

  useEffect(()=>{
    function onScroll() { setScrolled(window.scrollY > 40); }
    window.addEventListener("scroll", onScroll);
    return ()=>window.removeEventListener("scroll", onScroll);
  },[]);

  function toast_(msg) { setToast(msg); setTimeout(()=>setToast(null),2400); }

  function launchFromHero() {
    const from = heroOriginRef.current?.value || heroOrigin;
    const to = heroDestRef.current?.value || heroDest;
    if (!from || !to) { toast_("Enter your starting point and destination"); return; }
    setHeroOrigin(from); setHeroDest(to);
    setOrigin(from); setDest(to);
    setView("app");
    window.scrollTo(0,0);
    setTimeout(()=>{
      if (originRef.current) originRef.current.value = from;
      if (destRef.current) destRef.current.value = to;
      if (isLoaded && window.google) fetchDirections();
      const first = nextQ(0,{});
      setQIndex(first);
      setConvo([
        {role:"ai", text:`Let's plan your trip from ${from} to ${to}. A few quick questions:`},
        {role:"ai", text:QUESTIONS[first].ask}
      ]);
    }, 300);
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

    let openingMsg;
    if (routeInfo) {
      const hours = parseInt(routeInfo.duration);
      const suggestedStops = hours <= 6 ? 1 : hours <= 12 ? 2 : hours <= 18 ? 3 : 4;
      openingMsg = `${routeInfo.distance} · ${routeInfo.duration} drive · ${suggestedStops} suggested stop${suggestedStops > 1 ? "s" : ""}`;
    } else {
      openingMsg = `Planning your trip from ${origin} to ${dest}.`;
    }

    setConvo([
      {role:"ai", text:openingMsg},
      {role:"ai", text:QUESTIONS[first].ask}
    ]);
  }

  function submitAnswer(value) {
    const q=QUESTIONS[qIndex];
    const na={...answers,[q.id]:value};
    setAnswers(na); setTextInput("");
    const nc=[...convo,{role:"user",text:value}];
    const next=nextQ(qIndex+1,na);
    if(next===-2) {
      setConvo([...nc,{role:"ai",text:"Got it. Ready to generate your trip plan?"}]);
      setQIndex(-2); setConvoComplete(true);
    }
    else { setConvo([...nc,{role:"ai",text:QUESTIONS[next].ask}]); setQIndex(next); }
  }

  async function generateTrip() {
    setLoading(true);
    // Stay on plan tab — results appear below in same panel

    // Re-fetch directions with vehicle type from answers
    if (isLoaded && window.google && originRef.current?.value && destRef.current?.value) {
      fetchDirections(answers.vehicle, answers.trailer_detail);
    }

    try {
      const response = await fetch("/api/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination: dest,
          answers,
          routeInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to generate trip");

      // Map Claude response to stops format
      if (data.road_stops) {
        // Day trip / driving home — categorized road stops
        setRoadStops(data.road_stops);
        setStops([]);
      } else {
        // Overnight trip — hotel stops
        const aiStops = (data.stops || []).map(stop => ({
          city: stop.city,
          distance: stop.distance,
          eta: stop.eta,
          why: stop.why,
          hotels: (stop.hotels || []).map(h => ({ name: h.name, stars: h.stars, price: h.price, pet: h.pet })),
          restaurants: (stop.restaurants || []).map(r => ({ name: r.name, cuisine: r.cuisine, rating: r.rating, time: r.time })),
        }));
        setStops(aiStops);
        setRoadStops([]);
      }

      if (data.tips?.length) setTripTips(data.tips);
      setGenerated(true);
      // AI works silently — no chat messages after generation

    } catch (err) {
      console.error("Generate trip error:", err);
      toast_("Something went wrong — try again");
      // Fall back to placeholder data
      const hours = routeInfo ? parseInt(routeInfo.duration) : 10;
      const numStops = hours <= 6 ? 1 : hours <= 12 ? 2 : hours <= 20 ? 3 : 4;
      setStops(STOPS_DATA.slice(0, numStops));
      setGenerated(true);
    }

    setLoading(false);
    toast_("Trip planned");
  }

  function resetPlan() {
    setConvo([]); setAnswers({}); setQIndex(-1);
    setConvoComplete(false); setGenerated(false); setStops([]); setTripTips([]); setRoadStops([]); setStopCategory("all");
  }

  const currentQ = qIndex>=0 ? QUESTIONS[qIndex] : null;

  function SummaryCard() {
    const rows=[
      ["Trip", answers.trip_type],
      ["Vehicle", answers.vehicle],
      answers.trailer_detail&&["Trailer", answers.trailer_detail],
      ["Fuel", answers.fuel],
      answers.pets&&["Pets", answers.pets==="Yes"?`Yes — ${answers.pet_desc||""}`:"No"],
      answers.overnight&&["Overnight", answers.overnight],
      answers.lodging&&["Lodging", answers.lodging],
      answers.restaurants&&["Restaurants", answers.restaurants],
      answers.grocery&&["Grocery", answers.grocery],
      answers.extra&&answers.extra!=="skip"&&["Notes", answers.extra],
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

  const isOvernightTrip = (answers.trip_type === "Road trip" && answers.overnight !== "No") || answers.overnight === "Yes";
  const isDayOrHomeTrip = answers.trip_type === "Driving home" || answers.trip_type === "Day trip" || answers.overnight === "No";

  const planPanel = (
    <div className="chat-wrap">
      <div className="chat-header">
        <div className="chat-title">Plan your trip.</div>
        <div className="chat-sub">Answer a few quick questions and we'll handle everything.</div>
      </div>
      <div className="route-wrap">
        <div className="route-input-wrap">
          <div className="route-dot"/>
          {isLoaded ? (
            <Autocomplete onPlaceChanged={fetchDirections} options={{types:["geocode","establishment"]}}>
              <input ref={originRef} className="route-input" placeholder="Starting from…" defaultValue={origin}/>
            </Autocomplete>
          ) : (
            <input className="route-input" placeholder="Starting from…" value={origin} onChange={e=>setOrigin(e.target.value)}/>
          )}
        </div>
        <div className="route-line"/>
        <div className="route-input-wrap">
          <div className="route-dot dest"/>
          {isLoaded ? (
            <Autocomplete onPlaceChanged={fetchDirections} options={{types:["geocode","establishment"]}}>
              <input ref={destRef} className="route-input" placeholder="Going to…" defaultValue={dest}/>
            </Autocomplete>
          ) : (
            <input className="route-input" placeholder="Going to…" value={dest} onChange={e=>setDest(e.target.value)}/>
          )}
        </div>
      </div>
      <div className="convo-wrap">
        {/* RESULTS VIEW — shown after generating */}
        {generated && (stops.length > 0 || roadStops.length > 0) ? (
          <div className="results-view">
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <button onClick={resetPlan} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--muted)",display:"flex",alignItems:"center",gap:4,padding:0}}>
                ← Start over
              </button>
              <div style={{flex:1,fontFamily:"Syne",fontWeight:700,fontSize:13,textAlign:"center"}}>{origin} → {dest}</div>
              <button onClick={saveTrip} style={{background:"var(--accent)",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                Save
              </button>
            </div>
            <div className="section-sep"/>
            <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--muted)",marginBottom:8}}>
              {isDayOrHomeTrip ? "Stops along the way" : "Overnight stops"}
            </div>

            {/* Categorized road stops for day/home trips */}
            {isDayOrHomeTrip && roadStops.length > 0 && (
              <>
                {/* Category filter tabs */}
                <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                  {["all","fuel","food","rest","charging"].filter(cat =>
                    cat === "all" || roadStops.some(s => s.category === cat)
                  ).map(cat => (
                    <button key={cat} onClick={()=>setStopCategory(cat)} style={{
                      padding:"4px 12px", borderRadius:99, fontSize:11, fontWeight:600,
                      border: "1.5px solid", cursor:"pointer",
                      background: stopCategory===cat ? "var(--ink)" : "transparent",
                      color: stopCategory===cat ? "#fff" : "var(--muted)",
                      borderColor: stopCategory===cat ? "var(--ink)" : "var(--border)",
                      transition:"all 0.15s",
                    }}>
                      {cat === "all" ? "All" : cat === "fuel" ? "Fuel" : cat === "food" ? "Food" : cat === "rest" ? "Rest" : "Charging"}
                    </button>
                  ))}
                </div>
                {roadStops
                  .filter(s => stopCategory === "all" || s.category === stopCategory)
                  .map((s,i) => (
                    <div key={i} className="stop-card" style={{marginBottom:8,animationDelay:i*0.07+"s"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px"}}>
                        <div style={{
                          width:36,height:28,borderRadius:6,flexShrink:0,
                          background: s.category==="fuel"?"rgba(224,124,58,0.12)":s.category==="food"?"rgba(42,191,110,0.12)":s.category==="charging"?"rgba(74,159,212,0.12)":"rgba(138,138,138,0.1)",
                          display:"flex",alignItems:"center",justifyContent:"center",
                        }}>
                          <span style={{
                            fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",
                            color: s.category==="fuel"?"#e07c3a":s.category==="food"?"#2abf6e":s.category==="charging"?"#4a9fd4":"#8a8a8a",
                          }}>
                            {s.category==="fuel"?"FUEL":s.category==="food"?"FOOD":s.category==="charging"?"EV":"REST"}
                          </span>
                        </div>
                        <div style={{flex:1}}>
                          <div className="road-stop-name" style={{fontWeight:700,fontSize:13}}>{s.name}</div>
                          <div className="road-stop-loc" style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.location} · {s.distance}</div>
                          {s.note && <div className="road-stop-note" style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.note}</div>}
                        </div>
                        <div style={{fontSize:11,color:"var(--muted)",flexShrink:0}}>{s.eta}</div>
                      </div>
                      <div style={{padding:"0 14px 10px",display:"flex",gap:6}}>
                        <button className="action-btn action-btn-primary" style={{flex:1}} onClick={()=>toast_("Added to route!")}>Add to route</button>
                        <button className="action-btn" onClick={()=>toast_("Stop added to map")}>Map</button>
                      </div>
                    </div>
                  ))
                }
              </>
            )}
            {/* Overnight stops — with filter tabs like day trips */}
            {!isDayOrHomeTrip && stops.length > 0 && (
              <>
                <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                  {["all","hotel","food"].filter(cat =>
                    cat === "all" ||
                    (cat === "hotel" && stops.some(s => s.hotels?.length > 0)) ||
                    (cat === "food" && stops.some(s => s.restaurants?.length > 0))
                  ).map(cat => (
                    <button key={cat} onClick={()=>setStopCategory(cat)} style={{
                      padding:"4px 12px", borderRadius:99, fontSize:11, fontWeight:600,
                      border:"1.5px solid", cursor:"pointer",
                      background: stopCategory===cat ? "var(--ink)" : "transparent",
                      color: stopCategory===cat ? "#fff" : "var(--muted)",
                      borderColor: stopCategory===cat ? "var(--ink)" : "var(--border)",
                      transition:"all 0.15s",
                    }}>
                      {cat === "all" ? "All" : cat === "hotel" ? "Hotels" : "Dining"}
                    </button>
                  ))}
                </div>

                {stops.map((stop,i)=>(
                  <div className="stop-card" key={i} style={{marginBottom:8,animationDelay:i*0.07+"s"}}>
                    {/* Stop header */}
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:"1.5px solid var(--border)"}}>
                      <div style={{width:26,height:26,borderRadius:"50%",background:"var(--ink)",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"Syne"}}>
                        {i+1}
                      </div>
                      <div style={{flex:1}}>
                        <div className="stop-city">{stop.city}</div>
                        <div className="stop-meta">{stop.distance} · {stop.eta} drive</div>
                      </div>
                      {stop.why&&<div style={{fontSize:10,color:"var(--muted)",fontStyle:"italic",maxWidth:80,textAlign:"right"}}>{stop.why}</div>}
                    </div>

                    {/* Hotels */}
                    {(stopCategory==="all"||stopCategory==="hotel") && stop.hotels?.length>0&&(
                      <div style={{padding:"10px 14px 0"}}>
                        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"var(--muted)",marginBottom:7,display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:34,height:20,borderRadius:4,background:"rgba(42,122,224,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{fontSize:8,fontWeight:700,color:"#2a7ae0",letterSpacing:0.5}}>HOTEL</span>
                          </div>
                          Lodging
                        </div>
                        {stop.hotels.map((h,hi)=>(
                          <div className="item-row" key={hi} onClick={()=>toast_(`Booking ${h.name}`)}>
                            <div className="item-info">
                              <div className="item-name">{h.name}</div>
                              <div className="item-meta">{h.stars}-star · {h.pet?"Pet-friendly":"No pets"}</div>
                            </div>
                            <div className="item-price">{h.price}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Restaurants */}
                    {(stopCategory==="all"||stopCategory==="food") && answers.restaurants==="Yes"&&stop.restaurants?.length>0&&(
                      <div style={{padding:"10px 14px 0"}}>
                        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"var(--muted)",marginBottom:7,display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:34,height:20,borderRadius:4,background:"rgba(42,191,110,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{fontSize:8,fontWeight:700,color:"#2abf6e",letterSpacing:0.5}}>FOOD</span>
                          </div>
                          Dining
                        </div>
                        {stop.restaurants.map((r,ri)=>(
                          <div className="item-row" key={ri} onClick={()=>toast_(`Booking ${r.name}`)}>
                            <div className="item-info">
                              <div className="item-name">{r.name}</div>
                              <div className="item-meta">{r.cuisine} · {r.rating} stars</div>
                            </div>
                            <div className="item-time">{r.time}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{padding:"10px 14px 12px",display:"flex",gap:7,marginTop:4}}>
                      <button className="action-btn action-btn-primary" style={{flex:2}} onClick={()=>toast_("Hotel reserved!")}>Reserve hotel</button>
                      {answers.grocery==="Yes"&&<button className="action-btn" onClick={()=>setModal({type:"grocery",city:stop.city})}>Grocery</button>}
                      <button className="action-btn" onClick={()=>toast_("Stop added to map")}>Map</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {tripTips.length>0&&(
              <div style={{marginTop:12,padding:"14px",background:"var(--surface)",borderRadius:"var(--r)",border:"1px solid var(--border)"}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--muted)",marginBottom:10}}>Trip Tips</div>
                {tripTips.map((tip,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:7,fontSize:12.5,lineHeight:1.5}}>
                    <span style={{color:"var(--accent)",fontWeight:700,flexShrink:0}}>→</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* CONVERSATION VIEW — shown while planning */
          <div className="plan-view">
            {qIndex===-1&&convo.length===0&&(
              <div style={{textAlign:"center",padding:"32px 0"}}>
                <div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}>Enter your route above, then tap below to get started.</div>
                <button className="btn-generate" style={{width:"auto",padding:"10px 28px",display:"inline-block"}} onClick={startConvo}>Start planning</button>
              </div>
            )}
            {convo.map((msg,i)=>(
              msg.role==="ai"?(
                <div className="ai-msg" key={i}>
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
                {qIndex > 0 && (
                  <button onClick={() => {
                    let prev = qIndex - 1;
                    while (prev > 0 && QUESTIONS[prev].onlyIf && !QUESTIONS[prev].onlyIf(answers)) prev--;
                    const prevQ = QUESTIONS[prev];
                    setConvo(c => c.slice(0, -2));
                    const newAnswers = {...answers};
                    delete newAnswers[prevQ.id];
                    setAnswers(newAnswers);
                    setQIndex(prev);
                    setTextInput("");
                  }} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"var(--muted)",padding:"2px 0",display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                    ← Back
                  </button>
                )}
                {/* Visual separator between question and options */}
                <div style={{width:"100%",height:"1px",background:"var(--border)",opacity:0.5,margin:"2px 0 6px"}}/>
                <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--muted)",marginBottom:6}}>Choose one</div>
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
                  <>
                    <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--muted)",marginBottom:6}}>Your answer</div>
                    <div className="answer-input-wrap">
                      <input className="answer-input" placeholder={currentQ.placeholder} value={textInput} onChange={e=>setTextInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&textInput.trim()&&submitAnswer(textInput.trim())}/>
                      {currentQ.skippable&&<button className="answer-send" style={{background:"var(--surface)",color:"var(--muted)",border:"1px solid var(--border)"}} onClick={()=>submitAnswer("skip")}>Skip</button>}
                      <button className="answer-send" onClick={()=>textInput.trim()&&submitAnswer(textInput.trim())}>Send</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {convoComplete&&<div className="ai-msg"><SummaryCard/></div>}
            <div ref={convoEndRef}/>
          </div>
        )}
      </div>
      {convoComplete&&(
        <div className="generate-wrap">
          <button className="btn-generate" onClick={generateTrip} disabled={loading||generated}>
            {loading?<><span className="spinner"/>Planning your trip…</>:generated?"Trip Planned ✓":"Generate Trip Plan"}
          </button>
        </div>
      )}
    </div>
  );

  const TripsPanel = () => (
    <div className="stops-wrap">
      <div style={{fontFamily:"Syne",fontWeight:800,fontSize:17,marginBottom:4}}>Saved Trips</div>
      <div style={{fontSize:12,color:"var(--muted)",marginBottom:16}}>Your planned trips, ready to go.</div>
      {savedTrips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No saved trips</div>
          <div className="empty-sub">Plan a trip and tap Save to keep it here.</div>
        </div>
      ) : (
        savedTrips.map(trip => (
          <div key={trip.id} className="stop-card" style={{marginBottom:10}}>
            <div className="stop-card-head">
              <div style={{flex:1}}>
                <div className="stop-city">{trip.origin} → {trip.dest}</div>
                <div className="stop-meta">{trip.date} · {trip.stops.length} stop{trip.stops.length !== 1 ? "s" : ""} · {trip.routeInfo?.distance || ""}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className="action-btn" style={{flex:"none",padding:"4px 10px",fontSize:11}} onClick={() => {
                  setOrigin(trip.origin);
                  setDest(trip.dest);
                  setStops(trip.stops);
                  setTripTips(trip.tripTips || []);
                  setAnswers(trip.answers || {});
                  setGenerated(true);
                  setConvoComplete(true);
                  setTab("plan");
                  toast_("Trip loaded");
                }}>View</button>
                <button className="action-btn" style={{flex:"none",padding:"4px 10px",fontSize:11,color:"#e05c2a",borderColor:"#e05c2a"}} onClick={() => deleteSavedTrip(trip.id)}>✕</button>
              </div>
            </div>
          </div>
        ))
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
              {isLoaded ? (
                <Autocomplete onPlaceChanged={()=>{ if(heroOriginRef.current) setHeroOrigin(heroOriginRef.current.value); }} options={{types:["geocode","establishment"]}}>
                  <input ref={heroOriginRef} className="hero-input" placeholder="Dallas, TX" defaultValue={heroOrigin} onKeyDown={e=>e.key==="Enter"&&launchFromHero()}/>
                </Autocomplete>
              ) : (
                <input className="hero-input" placeholder="Dallas, TX" value={heroOrigin} onChange={e=>setHeroOrigin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&launchFromHero()}/>
              )}
            </div>
            <div className="hero-search-divider"/>
            <div className="hero-input-wrap">
              <div className="hero-input-label">To</div>
              {isLoaded ? (
                <Autocomplete onPlaceChanged={()=>{ if(heroDestRef.current) setHeroDest(heroDestRef.current.value); }} options={{types:["geocode","establishment"]}}>
                  <input ref={heroDestRef} className="hero-input" placeholder="Los Angeles, CA" defaultValue={heroDest} onKeyDown={e=>e.key==="Enter"&&launchFromHero()}/>
                </Autocomplete>
              ) : (
                <input className="hero-input" placeholder="Los Angeles, CA" value={heroDest} onChange={e=>setHeroDest(e.target.value)} onKeyDown={e=>e.key==="Enter"&&launchFromHero()}/>
              )}
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
      <style>{`
        /* ── App theme: Day ── */
        .app-wrap.day .nav-app { background: rgba(255,255,255,0.95); border-bottom: 1px solid #ebebeb; transition: background 1.8s ease, border-color 1.8s ease; }
        .app-wrap.day .nav-app .nav-logo { color: #0f1923; }
        .app-wrap.day .nav-app .nav-logo span { color: rgba(255,210,140,0.9); }
        .app-wrap.day .nav-app .nav-tab { color: #a0a0a0; }
        .app-wrap.day .nav-app .nav-tab.active { background: #fff; color: #0f1923; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .app-wrap.day .nav-app .nav-btn { background: none; border-color: #ebebeb; color: #a0a0a0; }
        .app-wrap.day .nav-app .nav-btn-primary { background: #0f1923; color: #fff; border-color: #0f1923; }
        .app-wrap.day .sidebar-inner { border-right: 1px solid rgba(0,0,0,0.06); }
        .app-wrap.night .sidebar-inner { border-right: 1px solid rgba(255,255,255,0.05); }
        .app-wrap.day .chat-title { color: #0f1923; }
        .app-wrap.day .chat-sub { color: #a0a0a0; }
        .app-wrap.day .route-input { background: rgba(255,255,255,0.85); border-color: rgba(0,0,0,0.1); color: #0a0c10; }
        .app-wrap.day .ai-bubble { background: #fafafa; border-color: #ebebeb; color: #0f1923; }
        .app-wrap.day .user-bubble { background: #0f1923; color: #fff; }
        .app-wrap.day .qr-btn { background: #fff; border-color: #ebebeb; color: #0f1923; }
        .app-wrap.day .btn-generate-app { background: #0f1923; color: #fff; }
        .app-wrap.day .map-placeholder-text { color: rgba(0,0,0,0.2); }

        /* ── App theme: Night ── */
        .app-wrap.night .nav-app { background: rgba(5,13,42,0.97); border-bottom: 1px solid rgba(255,255,255,0.08); transition: background 1.8s ease, border-color 1.8s ease; }
        .app-wrap.night .nav-app .nav-logo { color: #fff; }
        .app-wrap.night .nav-app .nav-logo span { color: rgba(255,210,140,0.9); }
        .app-wrap.night .nav-center-wrap { background: rgba(255,255,255,0.08); }
        .app-wrap.night .nav-app .nav-tab { color: rgba(255,255,255,0.45); }
        .app-wrap.night .nav-app .nav-tab.active { background: rgba(255,255,255,0.15); color: #fff; box-shadow: none; }
        .app-wrap.night .nav-app .nav-btn { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
        .app-wrap.night .nav-app .nav-btn-primary { background: #e07c3a; color: #fff; border-color: #e07c3a; }
        .app-wrap.night .sidebar-inner { border-right: 1px solid rgba(255,255,255,0.05); }
        .app-wrap.night .chat-title { color: #fff; }
        .app-wrap.night .chat-sub { color: rgba(255,255,255,0.45); }
        .app-wrap.night .route-wrap { border-bottom: 1px solid rgba(255,255,255,0.07); }
        .app-wrap.night .route-input { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); color: #ffffff !important; }
        .app-wrap.night .route-input::placeholder { color: rgba(255,255,255,0.25); }
        .app-wrap.night .route-line { background: rgba(255,255,255,0.1); }
        .app-wrap.night .route-dot { background: #fff; }
        .app-wrap.night .route-dot.dest { background: #e07c3a; }
        .app-wrap.night .convo-wrap { background: rgba(8,14,38,0.98); }
        .app-wrap.day .convo-wrap { background: rgba(235,248,240,0.82); }
        .app-wrap.night .ai-name { color: rgba(255,255,255,0.35); }
        .app-wrap.night .ai-bubble { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.08); color: #fff; }
        .app-wrap.night .user-bubble { background: #e07c3a; color: #fff; }
        .app-wrap.night .qr-btn { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: #fff; }
        .app-wrap.night .qr-btn:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); }
        .app-wrap.night .qr-btn.yes { border-color: #2abf6e; color: #2abf6e; }
        .app-wrap.night .qr-btn.yes:hover { background: #2abf6e; color: #fff; }
        .app-wrap.night .qr-btn.no { border-color: #e05c2a; color: #e05c2a; }
        .app-wrap.night .qr-btn.no:hover { background: #e05c2a; color: #fff; }
        .app-wrap.night .answer-input { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); color: #fff; }
        .app-wrap.night .answer-input::placeholder { color: rgba(255,255,255,0.25); }
        .app-wrap.night .answer-send { background: #e07c3a; }
        .app-wrap.night .summary-card { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); color: #fff; }
        .app-wrap.night .summary-key { color: rgba(255,255,255,0.4); }
        .app-wrap.night .generate-wrap { border-top: 1px solid rgba(255,255,255,0.07); background: rgba(8,14,38,0.98); }
        .app-wrap.day .generate-wrap { background: rgba(240,248,255,0.85); }
        .app-wrap.night .btn-generate { background: #e07c3a; }
        .app-wrap.night .chat-header { background: rgba(8,14,38,0.98); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .app-wrap.day .chat-header { background: rgba(240,248,255,0.85); border-bottom: 1px solid rgba(0,0,0,0.06); }
        .app-wrap.night .chat-wrap { background: transparent; }
        .app-wrap.day .chat-wrap { background: transparent; }
        .app-wrap.night .route-wrap { background: rgba(8,14,38,0.98); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .app-wrap.day .route-wrap { background: rgba(230,244,252,0.85); border-bottom: 1px solid rgba(0,0,0,0.06); }
        .app-wrap.night .map-placeholder-text { color: rgba(255,255,255,0.2); }
        .app-wrap.night .map-placeholder-sub { color: rgba(255,255,255,0.12); }
        .app-wrap.night .stop-card { background: #0d1935; border-color: rgba(255,255,255,0.08); }
        .app-wrap.night .stop-card-head { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.06); }
        .app-wrap.night .stop-city { color: #fff; }
        .app-wrap.night .stop-meta { color: rgba(255,255,255,0.4); }
        .app-wrap.night .stop-num { background: #e07c3a; }
        .app-wrap.night .item-row { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.07); }
        .app-wrap.night .item-row:hover { background: rgba(255,255,255,0.08); }
        .app-wrap.night .item-name { color: #fff; }
        .app-wrap.night .item-meta { color: rgba(255,255,255,0.5); }
        .app-wrap.night .item-price { color: #fff; }
        .app-wrap.night .road-stop-name { color: #fff !important; }
        .app-wrap.night .road-stop-loc { color: rgba(255,255,255,0.5) !important; }
        .app-wrap.night .road-stop-note { color: rgba(255,255,255,0.5) !important; }
        .app-wrap.night .stop-section-label { color: rgba(255,255,255,0.3); }
        .app-wrap.night .action-btn { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.1); color: #fff; }
        .app-wrap.night .action-btn:hover { background: rgba(255,255,255,0.13); }
        .app-wrap.night .action-btn-primary { background: #e07c3a; border-color: #e07c3a; }
        .app-wrap.night .section-sep { background: rgba(255,255,255,0.07); }
        .app-wrap.night .empty-title { color: #fff; }
        .app-wrap.night .empty-sub { color: rgba(255,255,255,0.4); }
        .app-wrap.night .share-title { color: #fff; }
        .app-wrap.night .share-sub { color: rgba(255,255,255,0.4); }
        .app-wrap.night .person-row { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }
        .app-wrap.night .person-name { color: #fff; }
        .app-wrap.night .person-status { color: rgba(255,255,255,0.4); }
        .app-wrap.night .stops-wrap { background: rgba(8,14,38,0.98); }
        .app-wrap.day .stops-wrap { background: rgba(235,248,240,0.82); }
        .app-wrap.night .fuel-row { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.07); }
        .app-wrap.night .fuel-label { color: #fff; }
        .app-wrap.night .fuel-meta-txt { color: rgba(255,255,255,0.4); }

        /* Sidebar gradient backgrounds */
        .app-wrap.day .sidebar-inner {
          background: linear-gradient(180deg, #b8dcf5 0%, #a8d4ee 15%, #b8e8cc 40%, #98d4a0 65%, #78c080 85%, #5aaa60 100%);
          border-right: 1px solid rgba(0,0,0,0.06);
        }
        .app-wrap.night .sidebar-inner {
          background: linear-gradient(180deg, #020818 0%, #050d2a 30%, #0a1840 60%, #0d2255 100%);
          border-right: 1px solid rgba(255,255,255,0.05);
        }

        /* Float card — frosted glass, subtle color from map */
        .app-wrap.day .float-card {
          background: rgba(255,255,255,0.92) !important;
          backdrop-filter: blur(20px) saturate(1.4) !important;
        }
        .app-wrap.night .float-card {
          background: rgba(5,10,32,0.88) !important;
          backdrop-filter: blur(20px) saturate(1.4) !important;
        }

        /* Logo fix */
        .app-wrap.day .nav-logo { color: #0f1923 !important; }
        .app-wrap.day .nav-logo span { color: rgba(255,210,140,0.9) !important; }
        .app-wrap.night .nav-logo { color: #ffffff !important; }
        .app-wrap.night .nav-logo span { color: rgba(255,210,140,0.9) !important; }

        /* Route dots */
        .app-wrap.night .route-dot { background: rgba(255,255,255,0.7) !important; }
        .app-wrap.night .route-dot.dest { background: rgba(255,210,140,0.9) !important; }
        .app-wrap.day .route-dot { background: #0f1923 !important; }
        .app-wrap.day .route-dot.dest { background: rgba(255,210,140,0.9) !important; }

        /* Stars in night sidebar */
        .app-wrap.night .sidebar-inner {
          position: relative; overflow: hidden;
          background: linear-gradient(180deg, #020818 0%, #050d2a 30%, #0a1840 60%, #0d2255 80%, #1a1a2e 100%) !important;
        }
        .app-wrap.night .sidebar-inner::before {
          content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            radial-gradient(1.5px 1.5px at 15% 8%, rgba(255,255,255,0.8) 0%, transparent 100%),
            radial-gradient(1px 1px at 30% 5%, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(2px 2px at 52% 4%, rgba(255,255,255,0.9) 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 10%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 85% 6%, rgba(255,255,255,0.7) 0%, transparent 100%),
            radial-gradient(1px 1px at 8% 18%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(2px 2px at 42% 15%, rgba(255,255,255,0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 75% 22%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 22% 28%, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 60% 25%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(2px 2px at 92% 35%, rgba(255,255,255,0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 5% 38%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 48% 32%, rgba(255,255,255,0.5) 0%, transparent 100%);
        }
        .app-wrap.night .sidebar-inner::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 35%;
          background: linear-gradient(to top, rgba(150,70,15,0.35) 0%, rgba(110,50,10,0.15) 50%, transparent 100%);
          pointer-events: none; z-index: 0;
        }
        .app-wrap.night .chat-wrap, .app-wrap.night .stops-wrap, .app-wrap.night .share-wrap { position: relative; z-index: 1; }

        /* Day sidebar */
        .app-wrap.day .sidebar-inner {
          position: relative; overflow: hidden;
          background: linear-gradient(180deg, #b8dcf5 0%, #a8d4ee 15%, #b8e8cc 40%, #98d4a0 65%, #78c080 85%, #5aaa60 100%) !important;
        }
        .app-wrap.day .sidebar-inner::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 25%;
          background: linear-gradient(to top, rgba(40,100,30,0.18) 0%, transparent 100%);
          pointer-events: none; z-index: 0;
        }
        .app-wrap.day .chat-wrap, .app-wrap.day .stops-wrap, .app-wrap.day .share-wrap { position: relative; z-index: 1; }

        /* Two-layer opacity crossfade — same technique as hero */
        .app-wrap .sidebar-day-layer, .app-wrap .sidebar-night-layer {
          position: absolute; inset: 0; pointer-events: none;
          transition: opacity 1.8s ease;
          z-index: 0;
        }
        .app-wrap .map-day-layer, .app-wrap .map-night-layer {
          position: absolute; inset: 0; pointer-events: none;
          transition: opacity 1.8s ease;
          z-index: 0;
        }
        .app-wrap .map-day-layer { background: linear-gradient(150deg, #e4eef5 0%, #d2e4f0 60%, #c0d6e8 100%); }
        .app-wrap .map-night-layer { background: linear-gradient(150deg, #020818 0%, #050d2a 50%, #0a1840 100%); }
        .app-wrap .map-placeholder { background: transparent !important; position: relative; }
        .app-wrap .map-placeholder-text, .app-wrap .map-placeholder-sub { position: relative; z-index: 1; }

        /* Force all color changes to sync at 1.8s */
        .app-wrap .ai-bubble,
        .app-wrap .user-bubble,
        .app-wrap .route-input,
        .app-wrap .qr-btn,
        .app-wrap .answer-input,
        .app-wrap .answer-send,
        .app-wrap .btn-generate,
        .app-wrap .chat-title,
        .app-wrap .chat-sub,
        .app-wrap .ai-name,
        .app-wrap .stop-card,
        .app-wrap .stop-card-head,
        .app-wrap .stop-city,
        .app-wrap .stop-meta,
        .app-wrap .stop-num,
        .app-wrap .item-row,
        .app-wrap .item-name,
        .app-wrap .item-meta,
        .app-wrap .item-price,
        .app-wrap .action-btn,
        .app-wrap .fuel-row,
        .app-wrap .fuel-label,
        .app-wrap .empty-title,
        .app-wrap .empty-sub,
        .app-wrap .share-title,
        .app-wrap .share-sub,
        .app-wrap .person-row,
        .app-wrap .person-name,
        .app-wrap .summary-card,
        .app-wrap .stops-wrap,
        .app-wrap .convo-wrap,
        .app-wrap .generate-wrap,
        .app-wrap .chat-header,
        .app-wrap .route-wrap,
        .app-wrap .route-line,
        .app-wrap .route-dot,
        .app-wrap .section-sep {
          transition: background 1.8s ease, background-color 1.8s ease, color 1.8s ease, border-color 1.8s ease !important;
        }

        /* Override CSS vars per theme so var(--ink) etc all transition together */
        .app-wrap.day { --ink: #0a0c10; --surface: #f4f1ec; --card: #ffffff; --border: #ebebeb; --muted: #a0a0a0; }
        .app-wrap.night { --ink: #ffffff; --surface: rgba(255,255,255,0.07); --card: rgba(255,255,255,0.06); --border: rgba(255,255,255,0.1); --muted: rgba(255,255,255,0.4); }

        /* All non-interactive elements transition at 1.8s */
        .app-wrap .ai-bubble, .app-wrap .user-bubble, .app-wrap .route-input,
        .app-wrap .qr-btn, .app-wrap .answer-input, .app-wrap .answer-send,
        .app-wrap .btn-generate, .app-wrap .chat-title, .app-wrap .chat-sub,
        .app-wrap .ai-name, .app-wrap .stop-card, .app-wrap .stop-card-head,
        .app-wrap .stop-city, .app-wrap .stop-meta, .app-wrap .stop-num,
        .app-wrap .item-row, .app-wrap .item-name, .app-wrap .item-meta,
        .app-wrap .item-price, .app-wrap .action-btn, .app-wrap .fuel-row,
        .app-wrap .fuel-label, .app-wrap .empty-title, .app-wrap .empty-sub,
        .app-wrap .share-title, .app-wrap .share-sub, .app-wrap .person-row,
        .app-wrap .person-name, .app-wrap .summary-card, .app-wrap .stops-wrap,
        .app-wrap .convo-wrap, .app-wrap .generate-wrap, .app-wrap .chat-header,
        .app-wrap .chat-wrap,
        .app-wrap .route-wrap, .app-wrap .route-line, .app-wrap .route-dot,
        .app-wrap .section-sep, .app-wrap .map-placeholder-text,
        .app-wrap .map-placeholder-sub, .app-wrap .nav-logo,
        .app-wrap .nav-tab, .app-wrap .nav-center-wrap {
          transition: background 1.8s ease, background-color 1.8s ease, color 1.8s ease, border-color 1.8s ease !important;
        }
        /* Sidebar and map layers use opacity */
        .app-wrap .sidebar-day-layer, .app-wrap .sidebar-night-layer,
        .app-wrap .map-day-layer, .app-wrap .map-night-layer {
          transition: opacity 1.8s ease !important;
        }
      `}</style>

      <div className={`app-wrap ${heroTheme}`} style={{
        display:"flex", flexDirection:"column", height:"100vh",
        transition: "color 1.8s ease",
      }}>
        <nav className="nav-app nav" style={{position:"fixed",top:0,left:0,right:0,zIndex:100,height:"var(--nav-h)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",backdropFilter:"blur(12px)"}}>
          <div className="nav-logo">Trip<span>Mappa</span></div>
          <div className="nav-center-wrap nav-center" style={{display:"flex",gap:"1px",borderRadius:8,padding:3}}>
            {[["plan","Plan"],["trips","Trips"],["share","Share"]].map(([k,l])=>(
              <button key={k} className={"nav-tab"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="nav-right" style={{display:"flex",gap:8,alignItems:"center"}}>
            <div className="theme-switch" onClick={()=>setHeroTheme(t=>t==="day"?"night":"day")}>
              <div className={`theme-switch-track ${heroTheme}`}>
                <div className={`theme-switch-thumb ${heroTheme}`}>{heroTheme==="day"?"☀️":"🌙"}</div>
              </div>
            </div>
            <button className="nav-btn" onClick={()=>toast_("Trip saved")}>Save trip</button>
            <button className="nav-btn nav-btn-primary" onClick={()=>toast_("Link copied")}>Share</button>
          </div>
        </nav>

        <div className="app" style={{position:"relative",height:"calc(100vh - var(--nav-h))"}}>
          {/* Full screen map */}
          <div className="map-full">
            {isLoaded ? (
              <>
                <GoogleMap
                  mapContainerClassName="gmap-wrap"
                  center={mapCenter}
                  zoom={4}
                  onLoad={map => {
                    mapRef.current = map;
                    if (polylineRef.current) polylineRef.current.setMap(null);
                  }}
                  options={{
                    disableDefaultUI: false,
                    zoomControl: true,
                    zoomControlOptions: { position: window.google?.maps?.ControlPosition?.RIGHT_CENTER },
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    styles: heroTheme === "night" ? [
                      {elementType:"geometry",stylers:[{color:"#0a1628"}]},
                      {elementType:"labels.text.fill",stylers:[{color:"#a0a0b0"}]},
                      {elementType:"labels.text.stroke",stylers:[{color:"#0a1628"}]},
                      {featureType:"road",elementType:"geometry",stylers:[{color:"#1a2d45"}]},
                      {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#2a4060"}]},
                      {featureType:"water",elementType:"geometry",stylers:[{color:"#050d2a"}]},
                      {featureType:"poi",stylers:[{visibility:"off"}]},
                      {featureType:"transit",stylers:[{visibility:"off"}]},
                    ] : [
                      {featureType:"poi",stylers:[{visibility:"off"}]},
                      {featureType:"transit",stylers:[{visibility:"off"}]},
                    ],
                  }}
                >
                  {routePath && (() => {
                    if (mapRef.current) {
                      if (polylineRef.current) polylineRef.current.setMap(null);
                      // Color route based on vehicle type
                      const color = routeInfo?.vehicleType === "Semi Truck" || routeInfo?.vehicleType === "Trailer"
                        ? "#4a9fd4" // blue for trucks
                        : routeInfo?.vehicleType === "RV / Camper"
                        ? "#2abf6e" // green for RV
                        : "#e07c3a"; // orange default
                      polylineRef.current = new window.google.maps.Polyline({
                        path: routePath,
                        geodesic: true,
                        strokeColor: color,
                        strokeOpacity: 0.9,
                        strokeWeight: 5,
                        map: mapRef.current,
                      });
                    }
                    return null;
                  })()}
                </GoogleMap>
                {routeInfo && (
                  <div className="route-info-bar">
                    <div className="rib-item"><div className="rib-val">{routeInfo.distance}</div><div className="rib-label">Distance</div></div>
                    <div style={{width:1,height:32,background:"rgba(255,255,255,0.1)"}}/>
                    <div className="rib-item"><div className="rib-val">{routeInfo.duration}</div><div className="rib-label">Drive Time</div></div>
                    <div style={{width:1,height:32,background:"rgba(255,255,255,0.1)"}}/>
                    <div className="rib-item">
                      <div className="rib-val" style={{fontSize:11}}>
                        {routeInfo.vehicleType === "Semi Truck" ? "🚛 Truck Route" :
                         routeInfo.vehicleType === "Trailer" ? "🚛 Trailer Route" :
                         routeInfo.vehicleType === "RV / Camper" ? "🚐 RV Route" :
                         routeInfo.vehicleType === "Motorcycle" ? "🏍 Moto Route" :
                         "🚗 Car Route"}
                      </div>
                      <div className="rib-label">{routeInfo.start} → {routeInfo.end}</div>
                    </div>
                    {(routeInfo.vehicleType === "Semi Truck" || routeInfo.vehicleType === "Trailer") && (
                      <>
                        <div style={{width:1,height:32,background:"rgba(255,255,255,0.1)"}}/>
                        <div className="rib-item">
                          <div className="rib-val" style={{fontSize:10,color:"#4a9fd4"}}>TRUCK SAFE</div>
                          <div className="rib-label">Avoids restrictions</div>
                        </div>
                      </>
                    )}
                    {routeInfo.vehicleType === "RV / Camper" && (
                      <>
                        <div style={{width:1,height:32,background:"rgba(255,255,255,0.1)"}}/>
                        <div className="rib-item">
                          <div className="rib-val" style={{fontSize:10,color:"#2abf6e"}}>RV FRIENDLY</div>
                          <div className="rib-label">RV optimized</div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="map-placeholder">
                <div className="map-placeholder-text">Loading map…</div>
                <div className="map-placeholder-sub">Connecting to Google Maps</div>
              </div>
            )}
          </div>

          {/* Floating glass card */}
          <div className={`float-card ${heroTheme} ${cardCollapsed?"collapsed":""}`}>
            <div className="float-card-header" onClick={()=>setCardCollapsed(c=>!c)}>
              <div className="float-card-title" style={{color: heroTheme==="night"?"#fff":"var(--ink)"}}>
                {tab==="plan"?"Plan Your Trip":tab==="trips"?"Saved Trips":"Live Sharing"}
              </div>
              <span className={`float-card-chevron ${cardCollapsed?"":"open"}`}>▼</span>
            </div>
            {!cardCollapsed && (
              <div className="float-card-scroll">
                <div className="sidebar-inner" style={{background:"transparent"}}>
                  {tab==="plan"&&planPanel}
                  {tab==="trips"&&<TripsPanel/>}
                  {tab==="share"&&<SharePanel/>}
                </div>
              </div>
            )}
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
