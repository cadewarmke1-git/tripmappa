import { useState, useRef, useEffect, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const GOOGLE_LIBRARIES = ["places", "routes"];

const STANDARD_MAP_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const HERO_PHOTO_DAY = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80";
const HERO_PHOTO_NIGHT = "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1920&q=80";

const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0a1628" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a0a0b0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1628" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2d45" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a4060" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050d2a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Inter:wght@400;700&display=swap');
  :root {
    --ink: #0c1222;
    --surface: #f4f6fa;
    --card: #ffffff;
    --brand: #1d4ed8;
    --brand-hover: #1e40af;
    --brand-soft: rgba(29, 78, 216, 0.1);
    --accent: #1d4ed8;
    --accent2: #0ea5e9;
    --accent3: #10b981;
    --warm: #f59e0b;
    --danger: #ef4444;
    --muted: #64748b;
    --border: #e2e8f0;
    --nav-h: 64px;
    --r: 12px;
    --r-lg: 16px;
    --r-xl: 20px;
    --sidebar-w: 380px;
    --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
    --shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
    --shadow-lg: 0 12px 48px rgba(15, 23, 42, 0.14);
    --shadow-glass: 0 8px 32px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.06);
    --glass: rgba(255, 255, 255, 0.72);
    --glass-border: rgba(255, 255, 255, 0.85);
    --ease: cubic-bezier(0.22, 1, 0.36, 1);
    --gold: rgba(255,210,140,0.9);
    --gold-soft: rgba(255,210,140,0.15);
    --charcoal: #0c1222;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: var(--surface); color: var(--ink); min-height: 100vh; font-size: 14px; -webkit-font-smoothing: antialiased; letter-spacing: -0.01em; }

  /* ── Nav ── */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: var(--nav-h);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 32px;
    transition: background 0.4s, border-color 0.4s, backdrop-filter 0.4s;
  }
  .nav.transparent { background: transparent !important; border-bottom: none !important; backdrop-filter: none !important; }
  .nav.solid { background: rgba(12,18,34,0.96); border-bottom: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(12px); }
  .nav-logo { font-family: 'Inter', sans-serif; font-size: 21px; font-weight: 700; letter-spacing: -0.5px; }
  .nav.transparent .nav-logo { color: #fff; }
  .nav.solid .nav-logo { color: #fff; }
  .nav.transparent .nav-logo span { color: var(--gold); }
  .nav.solid .nav-logo span { color: var(--gold); }
  .nav-center { display: flex; gap: 1px; border-radius: 8px; padding: 3px; }
  .nav.transparent .nav-center { background: rgba(255,255,255,0.12); }
  .nav.solid .nav-center { background: var(--border); }
  .nav-tab { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; padding: 7px 16px; border-radius: 8px; transition: background 0.2s var(--ease), color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
  .nav.transparent .nav-tab { color: rgba(255,255,255,0.65); }
  .nav.transparent .nav-tab:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .nav.transparent .nav-tab.active { background: rgba(255,255,255,0.2); color: #fff; font-weight: 700; }
  .nav.solid .nav-tab { color: rgba(255,255,255,0.55); }
  .nav.solid .nav-tab:hover { color: #fff; }
  .nav.solid .nav-tab.active { background: rgba(255,255,255,0.12); color: #fff; font-weight: 700; box-shadow: none; }
  .nav-right { display: flex; gap: 8px; }
  .nav-btn { border: 1px solid; cursor: pointer; border-radius: 10px; padding: 8px 16px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; transition: background 0.2s var(--ease), border-color 0.2s var(--ease), color 0.2s var(--ease), transform 0.15s var(--ease); }
  .nav-btn:hover { transform: translateY(-1px); }
  .nav-btn:active { transform: translateY(0); }
  .nav.transparent .nav-btn { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); color: #fff; }
  .nav.transparent .nav-btn:hover { background: rgba(255,255,255,0.22); }
  .nav.transparent .nav-btn-ghost { background: none !important; border: none !important; color: rgba(255,255,255,0.92) !important; box-shadow: none !important; }
  .nav.transparent .nav-btn-ghost:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
  .nav.transparent .nav-btn-signup { background: var(--gold) !important; border: none !important; color: var(--charcoal) !important; font-weight: 600 !important; box-shadow: 0 4px 16px rgba(255,210,140,0.35) !important; }
  .nav.transparent .nav-btn-signup:hover { background: rgba(255,220,155,0.95) !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,210,140,0.45) !important; }
  .nav.transparent .nav-btn-primary { background: var(--gold); border-color: transparent; color: var(--charcoal); }
  .nav.solid .nav-btn { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.85); }
  .nav.solid .nav-btn:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
  .nav.solid .nav-btn-primary { background: var(--gold); color: var(--charcoal); border-color: transparent; font-weight: 700; }

  /* ── Hero ── */
  .hero {
    position: relative; min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .hero-bg {
    position: absolute; inset: 0; z-index: 0;
    background-size: cover; background-position: center; background-repeat: no-repeat;
    transition: opacity 1.8s ease;
  }
  .hero-overlay {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%);
    transition: background 1.8s ease;
  }
  .hero.night .hero-overlay {
    background: linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%);
  }

  /* Hero content */
  .hero-content {
    position: relative; z-index: 10;
    text-align: center; padding: 0 28px;
    width: 100%; max-width: 680px;
    animation: heroIn 1s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes heroIn { from { opacity:0; transform: translateY(30px); } to { opacity:1; transform: translateY(0); } }

  .hero-title {
    font-family: 'Fraunces', serif; font-weight: 700;
    font-size: clamp(48px, 8.5vw, 96px);
    line-height: 0.98; letter-spacing: -0.02em;
    color: #fff; margin: 24px 0 36px;
    text-shadow: 0 2px 24px rgba(0,0,0,0.35);
  }
  .hero-title .highlight { color: var(--gold); }

  .hero-sub {
    font-family: 'Inter', sans-serif;
    font-size: 17px; color: rgba(255,255,255,0.7); max-width: 440px;
    margin: 0 auto 52px; line-height: 1.65; font-weight: 400;
  }

  /* Hero search bar — frosted glass */
  .hero-search {
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 24px; padding: 12px 12px 12px 26px;
    display: flex; align-items: center; gap: 16px;
    width: 100%; max-width: 600px; margin: 0 auto 40px;
    border: 1px solid rgba(255,255,255,0.3);
    box-shadow: 0 16px 48px rgba(0,0,0,0.2);
    animation: heroIn 1s 0.2s cubic-bezier(0.16,1,0.3,1) both;
    transition: box-shadow 0.25s var(--ease), border-color 0.25s var(--ease), background 0.25s var(--ease);
  }
  .hero-search:focus-within {
    border-color: rgba(255,255,255,0.45);
    box-shadow: 0 20px 56px rgba(0,0,0,0.28), 0 0 0 3px rgba(255,255,255,0.08);
  }
  .hero-search-fields { display: flex; align-items: stretch; gap: 12px; flex: 1; min-width: 0; }
  .hero-search-divider-wrap {
    position: relative; display: flex; align-items: center; justify-content: center;
    width: 36px; flex-shrink: 0; align-self: stretch;
  }
  .hero-search-divider {
    position: absolute; left: 50%; top: 6px; bottom: 6px; width: 1px;
    transform: translateX(-50%); height: auto; background: rgba(255,255,255,0.3);
  }
  .hero-swap-btn {
    position: relative; z-index: 2;
    width: 30px; height: 30px; border-radius: 50%;
    background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
    color: #fff; font-size: 13px; line-height: 1; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), background 0.2s var(--ease);
  }
  .hero-swap-btn:hover { transform: rotate(180deg); border-color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.22); }
  .timing-menu {
    position: absolute; top: calc(100% + 8px); left: 0; min-width: 180px;
    background: rgba(255,255,255,0.98); border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px; padding: 6px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); z-index: 200;
  }
  .app-wrap.night .timing-menu { background: rgba(15,22,40,0.96); border-color: rgba(255,255,255,0.12); }
  .timing-menu-item {
    display: block; width: 100%; text-align: left; padding: 10px 14px;
    border: none; background: none; border-radius: 8px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; color: var(--charcoal);
  }
  .app-wrap.night .timing-menu-item { color: #fff; }
  .timing-menu-item:hover { background: rgba(255,210,140,0.12); }
  .timing-menu-item.active { background: rgba(255,210,140,0.18); font-weight: 700; }
  .route-arrive-picker {
    margin-top: 8px; padding: 10px 14px; width: 100%;
    border: 1px solid rgba(255,210,140,0.25); border-radius: 12px;
    background: rgba(255,255,255,0.85); color: var(--charcoal); font-family: 'Inter', sans-serif; font-size: 13px;
  }
  .app-wrap.night .route-arrive-picker { background: rgba(255,255,255,0.06); border-color: rgba(255,210,140,0.2); color: #fff; }
  .route-timing-wrap { position: relative; margin-top: 8px; }
  .route-timing-btn {
    background: rgba(255,255,255,0.7); border: 1px solid rgba(255,210,140,0.25);
    border-radius: 99px; padding: 8px 16px; font-family: 'Inter', sans-serif;
    font-size: 12px; font-weight: 400; color: var(--charcoal); cursor: pointer;
    transition: background 0.2s var(--ease), border-color 0.2s var(--ease);
  }
  .route-timing-btn:hover { border-color: rgba(255,210,140,0.45); background: rgba(255,255,255,0.9); }
  .app-wrap.night .route-timing-btn { background: rgba(255,210,140,0.08); border-color: rgba(255,210,140,0.15); color: rgba(255,255,255,0.9); }
  @media (max-width: 540px) {
    .hero-search { flex-direction: column; padding: 16px; border-radius: 16px; gap: 10px; }
    .hero-search-fields { flex-direction: column; width: 100%; gap: 10px; }
    .hero-search-divider-wrap { width: 100%; height: 36px; align-self: auto; }
    .hero-search-divider { top: 50%; bottom: auto; left: 0; right: 0; width: auto; height: 1px; transform: translateY(-50%); }
    .hero-input-wrap { width: 100%; }
    .hero-go-btn { width: 100%; text-align: center; justify-content: center; }
    .hero-title { letter-spacing: -1.5px; }
    .hero-auth-btns { flex-wrap: wrap; }
  }
  .hero-input-wrap { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .hero-input-label { font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 5px; }
  .hero-input {
    border: none; outline: none; font-family: 'Inter', sans-serif;
    font-size: 15px; font-weight: 400; color: #fff;
    background: transparent; width: 100%; padding: 0;
  }
  .hero-input::placeholder { color: rgba(255,255,255,0.6); font-weight: 400; }
  .hero-go-btn {
    background: #1a1a2e;
    color: #fff; border: none; border-radius: var(--r-lg);
    padding: 15px 28px; font-family: 'Inter', sans-serif;
    font-size: 14px; font-weight: 700; cursor: pointer;
    transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease); white-space: nowrap;
    flex-shrink: 0;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }
  .hero-go-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45); }
  .hero-go-btn:active { transform: translateY(0); box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3); }

  .hero-hint {
    font-size: 12px; color: rgba(255,255,255,0.45);
    animation: heroIn 1s 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }
  .hero-hint span { color: var(--gold); }

  /* Auth buttons — frosted glass */
  .hero-auth { margin-top: 8px; margin-bottom: 40px; animation: heroIn 1s 0.35s cubic-bezier(0.16,1,0.3,1) both; }
  .hero-auth-label { font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 14px; font-weight: 700; }
  .hero-auth-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .hero-auth-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    border-radius: var(--r-lg); padding: 11px 22px; min-width: 132px;
    font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400;
    cursor: pointer; transition: transform 0.2s var(--ease), background 0.2s var(--ease), border-color 0.2s var(--ease);
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
  }
  .hero-auth-btn:hover { transform: translateY(-2px); background: rgba(255,255,255,0.22); border-color: rgba(255,255,255,0.35); }
  .hero-auth-btn:active { transform: translateY(0); }

  /* Email sign up */
  .hero-auth-or {
    display: flex; align-items: center; gap: 16px;
    margin: 22px auto 18px; max-width: 400px; width: 100%;
  }
  .hero-auth-or::before, .hero-auth-or::after {
    content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.18);
  }
  .hero-auth-or span { font-size: 12px; color: rgba(255,255,255,0.45); font-weight: 500; flex-shrink: 0; }
  .hero-email-form { width: 100%; max-width: 400px; margin: 0 auto; }
  .hero-email-btn {
    background: transparent; color: #fff;
    border: 1.5px solid rgba(255,255,255,0.5); border-radius: var(--r-lg);
    padding: 14px 28px; font-family: 'Inter', sans-serif;
    font-size: 14px; font-weight: 400; cursor: pointer;
    transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), background 0.2s var(--ease);
    width: 100%;
  }
  .hero-email-btn:hover { border-color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.08); transform: translateY(-1px); }
  .hero-email-btn:active { transform: translateY(0); }

  /* Map style toggle */
  .map-style-toggle {
    position: absolute; bottom: 108px; right: 12px; z-index: 20;
  }
  .map-style-btn {
    width: 40px; height: 40px; border-radius: 10px;
    background: rgba(255,255,255,0.96); border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 2px 12px rgba(0,0,0,0.15); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: var(--charcoal);
    transition: box-shadow 0.2s var(--ease);
  }
  .map-style-btn:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
  .map-style-menu {
    position: absolute; bottom: calc(100% + 8px); right: 0; min-width: 140px;
    background: rgba(255,255,255,0.98); border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px; padding: 6px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  }
  .map-style-item {
    display: block; width: 100%; text-align: left; padding: 10px 14px;
    border: none; background: none; border-radius: 8px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; color: var(--charcoal);
  }
  .map-style-item:hover { background: rgba(255,210,140,0.12); }
  .map-style-item.active { background: rgba(255,210,140,0.2); font-weight: 600; }

  /* Traffic alert toast */
  .traffic-toast {
    position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
    z-index: 25; display: flex; align-items: center; gap: 10px;
    background: rgba(12,18,34,0.92); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,210,140,0.25); border-radius: 99px;
    padding: 10px 20px; font-size: 13px; font-weight: 500; color: #fff;
    box-shadow: 0 4px 24px rgba(0,0,0,0.25);
    animation: trafficToastIn 0.35s var(--ease) both;
    white-space: nowrap; max-width: calc(100vw - 32px);
  }
  .traffic-toast-icon { color: var(--gold); font-size: 16px; }
  @keyframes trafficToastIn { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* Float card help — header */
  .float-card-header { overflow: visible; z-index: 60; }
  .float-card-header-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; position: relative; }
  .float-card-help-wrap { position: relative; z-index: 200; }
  .float-card-help-btn {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(255,255,255,0.85); border: 1px solid rgba(0,0,0,0.06);
    color: var(--charcoal); font-size: 14px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s var(--ease), border-color 0.2s var(--ease);
  }
  .float-card-help-btn:hover { border-color: rgba(255,210,140,0.5); background: #fff; }
  .float-card.night .float-card-help-btn { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); color: #fff; }
  .help-menu {
    position: absolute; top: calc(100% + 8px); right: 0; min-width: 168px;
    background: rgba(255,255,255,0.98); border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px; padding: 6px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); z-index: 300;
  }
  .float-card.night .help-menu { background: rgba(12,18,34,0.98); border-color: rgba(255,255,255,0.12); }
  .help-menu-item {
    display: block; width: 100%; text-align: left; padding: 10px 14px;
    border: none; background: none; border-radius: 8px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; color: var(--charcoal);
  }
  .float-card.night .help-menu-item { color: #fff; }
  .help-menu-item:hover { background: rgba(255,210,140,0.12); }
  .report-textarea {
    width: 100%; min-height: 120px; padding: 12px; border: 1.5px solid var(--border);
    border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 14px;
    resize: vertical; outline: none; margin-bottom: 14px;
  }
  .report-textarea:focus { border-color: rgba(255,210,140,0.6); box-shadow: 0 0 0 3px rgba(255,210,140,0.15); }

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

  .scroll-indicator {
    position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
    z-index: 10;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: rgba(255,255,255,0.35); font-size: 11px; letter-spacing: 1px;
    text-transform: uppercase; animation: bounce 2s ease-in-out infinite;
  }
  @keyframes bounce { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(6px); } }
  .scroll-arrow { width: 18px; height: 18px; border-right: 1.5px solid rgba(255,255,255,0.35); border-bottom: 1.5px solid rgba(255,255,255,0.35); transform: rotate(45deg); margin-top: -4px; }

  .pac-container {
    z-index: 100000 !important;
    border-radius: 14px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08) !important;
    border: 1.5px solid var(--border) !important;
    font-family: 'Inter', sans-serif !important;
    margin-top: 8px !important;
    overflow: hidden !important;
    background: #fff !important;
  }
  .pac-item {
    padding: 12px 18px !important;
    font-size: 13.5px !important;
    line-height: 1.45 !important;
    cursor: pointer !important;
    border-top: 1px solid var(--border) !important;
    color: var(--ink) !important;
  }
  .pac-item:first-child { border-top: none !important; }
  .pac-item:hover, .pac-item-selected { background: var(--surface) !important; }
  .pac-item-query { font-weight: 600 !important; color: var(--ink) !important; font-family: 'Inter', sans-serif !important; }
  .pac-matched { font-weight: 700 !important; color: var(--accent) !important; }
  .pac-icon { margin-top: 2px !important; }
  .map-area { flex: 1; position: relative; overflow: hidden; }
  .gmap-wrap { width: 100%; height: 100%; }
  .map-loading {
    width: 100%; height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    background: linear-gradient(150deg, #e4eef5 0%, #d2e4f0 60%, #c0d6e8 100%);
    font-family: 'Inter', sans-serif; font-size: 13px; color: #888;
  }
  .map-loading-skeleton { width: min(280px, 70%); display: flex; flex-direction: column; gap: 10px; opacity: 0.5; }
  .map-skeleton-bar { height: 10px; border-radius: 99px; background: rgba(0,0,0,0.08); animation: skeletonPulse 1.4s ease-in-out infinite; }
  .map-skeleton-bar:nth-child(1) { width: 100%; }
  .map-skeleton-bar:nth-child(2) { width: 72%; animation-delay: 0.15s; }
  .map-skeleton-bar:nth-child(3) { width: 48%; animation-delay: 0.3s; }
  @keyframes skeletonPulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.85; } }
  .loading-spinner {
    width: 28px; height: 28px; border: 2.5px solid rgba(0,0,0,0.08);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }
  .loading-spinner.light {
    border-color: rgba(255,255,255,0.2); border-top-color: #fff;
  }
  .route-loading-pill {
    position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
    z-index: 15; display: flex; align-items: center; gap: 10px;
    background: rgba(255,255,255,0.96); backdrop-filter: blur(12px);
    border: 1px solid rgba(0,0,0,0.08); border-radius: 99px;
    padding: 10px 18px; font-size: 13px; font-weight: 500; color: var(--ink);
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  }
  .spinner-dark {
    width: 16px; height: 16px; border: 2px solid rgba(0,0,0,0.1);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin 0.7s linear infinite; flex-shrink: 0;
  }
  .route-info-bar {
    position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: rgba(10,12,16,0.88); backdrop-filter: blur(16px) saturate(1.5);
    border-radius: 14px; padding: 12px 22px;
    display: flex; gap: 20px; align-items: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.08);
    z-index: 10; white-space: nowrap;
    max-width: calc(100vw - 32px);
    overflow: hidden;
  }
  .route-info-bar .rib-item { text-align: center; flex-shrink: 0; min-width: 0; }
  .route-info-bar .rib-val { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.3px; }
  .route-info-bar .rib-label { font-size: 9px; color: rgba(255,255,255,0.4); letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; }
  .route-info-bar .rib-divider { width: 1px; height: 32px; background: rgba(255,255,255,0.1); flex-shrink: 0; }
  @media (max-width: 640px) {
    .route-info-bar {
      bottom: 16px; padding: 8px 14px; gap: 12px; border-radius: 12px;
      max-width: calc(100vw - 24px);
    }
    .route-info-bar .rib-val { font-size: 12px; }
    .route-info-bar .rib-label { font-size: 8px; letter-spacing: 0.5px; }
    .route-info-bar .rib-divider { height: 24px; }
    .route-info-bar .rib-item-route,
    .route-info-bar .rib-item-badge,
    .route-info-bar .rib-divider-mobile-hide { display: none; }
  }
  /* ── App layout — full screen map with floating card ── */
  .app { padding-top: var(--nav-h); position: relative; height: 100vh; }
  .map-full { position: absolute; inset: 0; top: var(--nav-h); }
  .gmap-wrap { width: 100%; height: 100%; }

  /* Floating card — frosted glass */
  .float-card {
    position: absolute; top: calc(var(--nav-h) + 16px); left: 16px;
    width: 390px; max-height: calc(100vh - var(--nav-h) - 32px);
    backdrop-filter: blur(32px) saturate(1.5);
    -webkit-backdrop-filter: blur(32px) saturate(1.5);
    border-radius: 22px;
    display: flex; flex-direction: column;
    overflow: hidden; z-index: 50;
    transition: max-height 0.45s var(--ease), box-shadow 0.3s var(--ease), background 1.8s ease, border-color 1.8s ease;
  }
  .float-card > * { position: relative; z-index: 1; }
  .float-card.day {
    background: rgba(255, 253, 250, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.72);
    box-shadow: 0 20px 56px rgba(30, 90, 120, 0.1), 0 8px 24px rgba(20, 60, 90, 0.06), inset 0 1px 0 rgba(255,255,255,0.9);
  }
  .float-card.night {
    background: rgba(8, 14, 32, 0.82);
    border: 1px solid rgba(255,210,140,0.1);
    box-shadow: 0 20px 60px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,210,140,0.06);
  }
  .float-card.night::before {
    content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
    background-image: radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.35), transparent),
      radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.2), transparent),
      radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.25), transparent);
    opacity: 0.35;
  }
  .float-card.collapsed { max-height: 62px; }
  .float-card-body {
    flex: 1; min-height: 0; display: flex; flex-direction: column;
    overflow: hidden;
    transition: opacity 0.3s ease, flex 0.45s cubic-bezier(0.34, 1.1, 0.64, 1);
  }
  .float-card.collapsed .float-card-body {
    flex: 0; opacity: 0; pointer-events: none;
  }
  .float-card:not(.collapsed) .float-card-body { opacity: 1; }
  .float-card-scroll { overflow-y: auto; flex: 1; min-height: 0; -webkit-overflow-scrolling: touch; }
  .float-card-scroll::-webkit-scrollbar { width: 0; }
  .float-card-handle { display: none; }

  /* Mobile — bottom sheet */
  @media (max-width: 600px) {
    .float-card {
      left: 0; right: 0; top: auto; bottom: 0;
      width: 100%; max-width: 100%;
      max-height: 60vh;
      border-radius: 20px 20px 0 0;
      box-shadow: 0 -8px 40px rgba(0,0,0,0.18), 0 -2px 8px rgba(0,0,0,0.08);
    }
    .float-card.collapsed { max-height: 52px; }
    .float-card-handle {
      display: block; width: 36px; height: 4px; border-radius: 99px;
      background: rgba(0,0,0,0.14); margin: 0 auto 10px; flex-shrink: 0;
    }
    .float-card.night .float-card-handle { background: rgba(255,255,255,0.22); }
    .float-card-header { padding: 8px 16px 14px !important; flex-direction: column; align-items: stretch; }
    .float-card-header-row { display: flex; align-items: center; justify-content: space-between; }
    .chat-title { font-size: 18px !important; }
    .chat-header { padding: 16px 16px 12px !important; }
    .route-wrap { padding: 12px 16px !important; }
    .convo-wrap { padding: 16px !important; gap: 20px !important; }
    .generate-wrap { padding: 10px 14px 14px !important; }
    .stops-wrap { padding: 12px 12px 20px !important; }
    .route-loading-pill { top: 12px; max-width: calc(100% - 24px); }
  }

  /* Card header */
  .float-card-header {
    display: flex; flex-direction: column; align-items: stretch;
    padding: 18px 20px; cursor: pointer; user-select: none;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    flex-shrink: 0;
  }
  .float-card-header-row {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%;
  }
  .float-card.night .float-card-header { border-bottom-color: rgba(255,255,255,0.06); }
  .float-card-title { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.01em; }
  .float-card.night .float-card-title { color: #fff; }
  .float-card-chevron { font-size: 10px; color: var(--muted); transition: transform 0.3s; }
  .float-card-chevron.open { transform: rotate(180deg); }

  /* Map placeholder */
  .map-placeholder { width: 100%; height: 100%; background: linear-gradient(150deg, #e4eef5 0%, #d2e4f0 60%, #c0d6e8 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; }
  .map-placeholder-text { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700; color: rgba(0,0,0,0.18); }
  .map-placeholder-sub { font-size: 12px; color: rgba(0,0,0,0.12); }

  /* ── Chat panel — premium warm conversation ── */
  .chat-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; background: transparent; }
  .chat-header { padding: 28px 24px 22px; border-bottom: 1px solid rgba(0,0,0,0.05); background: transparent; }
  .chat-title { font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 700; color: var(--ink); margin-bottom: 10px; letter-spacing: -0.02em; line-height: 1.3; }
  .chat-sub { font-size: 14px; color: var(--muted); line-height: 1.65; font-weight: 400; }
  .route-wrap { padding: 20px 24px 22px; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 14px; background: transparent; }
  .route-input-wrap { position: relative; }
  .route-dot { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 7px; height: 7px; border-radius: 50%; background: var(--ink); }
  .route-dot.dest { background: var(--gold); }
  .route-input { width: 100%; padding: 12px 14px 12px 34px; border: 1px solid rgba(120,160,180,0.2); border-radius: 12px; font-family: 'Inter', sans-serif; font-size: 14px; background: rgba(255,255,255,0.92); color: var(--charcoal); outline: none; transition: all 0.2s var(--ease); font-weight: 400; }
  .route-input:focus { border-color: rgba(255,210,140,0.5); background: #fff; box-shadow: 0 0 0 3px rgba(255,210,140,0.12); }
  .route-input::placeholder { color: #c0bab4; }
  .route-line { width: 1.5px; height: 10px; background: var(--border); margin-left: 16px; }
  .convo-wrap { flex: 1; overflow-y: auto; min-height: 0; padding: 28px 24px; display: flex; flex-direction: column; gap: 0; background: transparent; }
  .convo-wrap::-webkit-scrollbar { width: 0px; }
  .plan-view, .convo-wrap > .ai-msg, .convo-wrap > .user-msg { margin: 0; }
  .ai-msg { display: flex; flex-direction: column; gap: 0; animation: fadeUp 0.35s cubic-bezier(0.34, 1.2, 0.64, 1) both; }
  .user-msg { display: flex; justify-content: flex-end; margin-top: 14px; animation: answerSlideIn 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) both; }
  .plan-route-hint {
    font-size: 11px; color: var(--muted); text-align: center; margin-bottom: 20px;
    padding: 11px 16px; background: rgba(255,210,140,0.12); border-radius: 12px;
    border: 1px solid rgba(255,210,140,0.18);
    font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
  }
  .step-active { animation: fadeUp 0.35s cubic-bezier(0.34, 1.2, 0.64, 1) both; }
  .step-exit { animation: stepExit 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards; pointer-events: none; }
  @keyframes stepExit { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-10px) scale(0.97); } }
  @keyframes answerSlideIn { from { opacity: 0; transform: translateY(12px) scale(0.92); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .question-choices {
    margin-top: 22px; padding-top: 22px;
    border-top: 1px solid rgba(0,0,0,0.06);
    display: flex; flex-direction: column; gap: 16px;
  }
  .app-wrap.night .question-choices { border-top-color: rgba(255,255,255,0.08); }
  .quick-replies { display: flex; flex-wrap: wrap; gap: 10px; }
  .convo-empty { text-align: center; padding: 36px 0; }
  .convo-empty p { font-size: 14px; color: var(--muted); margin-bottom: 16px; line-height: 1.55; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
  @keyframes fadeOut { from { opacity:1; } to { opacity:0; } }
  .results-view { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .plan-view { animation: fadeUp 0.2s ease both; }
  .ai-bubble {
    background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(255, 255, 255, 0.95);
    border-radius: 20px 20px 20px 6px;
    padding: 20px 22px; font-size: 15px; line-height: 1.65; color: var(--charcoal);
    max-width: 100%; font-weight: 400;
    box-shadow: 0 4px 18px rgba(15, 30, 50, 0.06);
  }
  .user-bubble {
    background: linear-gradient(165deg, #1a2332 0%, var(--charcoal) 100%);
    color: #fff; border-radius: 20px 20px 6px 20px;
    padding: 16px 22px; font-size: 15px; max-width: 85%; line-height: 1.55;
    font-weight: 700;
    box-shadow: 0 6px 20px rgba(12, 18, 34, 0.22);
  }
  .qr-btn {
    border: 1px solid rgba(255,210,140,0.35); background: rgba(255,255,255,0.96); border-radius: 99px;
    padding: 13px 24px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400;
    cursor: pointer;
    transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease), background 0.2s var(--ease), border-color 0.2s var(--ease);
    color: var(--charcoal);
    box-shadow: 0 2px 10px rgba(15, 30, 50, 0.05);
  }
  .qr-btn:hover { border-color: rgba(255,210,140,0.55); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(15, 30, 50, 0.08); }
  .qr-btn:active { transform: scale(0.98); }
  .qr-btn.qr-selected {
    animation: qrGoldFlash 380ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    border-color: rgba(255,210,140,0.7) !important;
    color: var(--charcoal) !important;
    pointer-events: none;
  }
  @keyframes qrGoldFlash {
    0% { background: rgba(255,255,255,0.96); box-shadow: 0 2px 10px rgba(15,30,50,0.05); transform: scale(1); opacity: 1; }
    20% { background: rgba(255,210,140,0.9); box-shadow: 0 0 0 4px rgba(255,210,140,0.3); transform: scale(1.03); opacity: 1; }
    100% { background: rgba(255,210,140,0.4); box-shadow: none; transform: scale(0.97); opacity: 0; }
  }
  .qr-btn.yes, .qr-btn.no { border-color: rgba(255,210,140,0.35); color: var(--charcoal); background: rgba(255,255,255,0.96); }
  .qr-btn.yes:hover, .qr-btn.no:hover { background: rgba(255,210,140,0.12); border-color: rgba(255,210,140,0.5); color: var(--charcoal); }
  .qr-btn.qr-dimmed { opacity: 0.35; pointer-events: none; transform: none !important; }
  .choices-frozen .qr-btn:not(.qr-selected) { opacity: 0.3; pointer-events: none; }
  .answer-input-wrap { display: flex; gap: 8px; }
  .answer-input { flex: 1; padding: 13px 18px; border: 1px solid rgba(0,0,0,0.08); border-radius: 99px; font-family: 'Inter', sans-serif; font-size: 14px; outline: none; transition: all 0.2s var(--ease); background: rgba(255,255,255,0.9); box-shadow: 0 2px 8px rgba(15,40,30,0.06); }
  .answer-input:focus { border-color: rgba(245,200,66,0.5); box-shadow: 0 0 0 3px rgba(245,200,66,0.15); }
  .answer-send { background: linear-gradient(180deg, #1a2332 0%, #0c1222 100%); color: #fff; border: none; border-radius: 99px; padding: 13px 22px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.2s; white-space: nowrap; box-shadow: 0 4px 14px rgba(12,18,34,0.25); }
  .answer-send:hover:not(:disabled) { transform: scale(1.03); }
  .answer-send:active:not(:disabled) { transform: scale(0.97); }
  .answer-send:disabled { opacity: 0.45; cursor: not-allowed; }
  .answer-send-muted { background: rgba(255,255,255,0.85) !important; color: var(--muted) !important; border: 1px solid rgba(0,0,0,0.08) !important; box-shadow: none !important; }
  .summary-card { background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; padding: 20px; font-size: 14px; line-height: 1.75; backdrop-filter: blur(8px); }
  .summary-row { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; }
  .summary-key { font-weight: 600; min-width: 88px; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; padding-top: 3px; }
  .generate-wrap { padding: 20px 24px 24px; border-top: 1px solid rgba(0,0,0,0.05); background: transparent; }
  .app-wrap.night .generate-wrap { border-top-color: rgba(255,255,255,0.06); }
  .btn-generate {
    width: 100%; min-height: 52px; padding: 16px 24px; border: none; cursor: pointer;
    background: linear-gradient(180deg, #1a2332 0%, var(--charcoal) 100%);
    color: #fff; border-radius: 16px; font-family: 'Inter', sans-serif;
    font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
    transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease);
    box-shadow: 0 6px 24px rgba(12, 18, 34, 0.28);
  }
  .btn-generate:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(12, 18, 34, 0.34); }
  .btn-generate:active:not(:disabled) { transform: scale(0.98); box-shadow: 0 4px 16px rgba(12, 18, 34, 0.24); }
  .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-generate-inline { width: auto; padding: 12px 28px; display: inline-block; }
  .spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Stops panel ── */
  .stops-wrap { padding: 16px 16px 24px; }
  .empty-state { text-align: center; padding: 48px 24px; }
  .empty-icon {
    width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 16px;
    display: flex; align-items: center; justify-content: center; font-size: 26px;
    background: var(--surface); border: 1.5px solid var(--border);
  }
  .empty-title { font-family: 'Inter', sans-serif; font-size: 17px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.3px; }
  .empty-sub { font-size: 13px; color: var(--muted); line-height: 1.6; max-width: 260px; margin: 0 auto 18px; }
  .empty-cta {
    display: inline-block; padding: 10px 22px; border-radius: 10px;
    background: var(--ink); color: #fff; border: none; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
  }
  .stop-card { background: #fff; border: 1.5px solid var(--border); border-radius: var(--r); margin-bottom: 10px; overflow: hidden; animation: fadeUp 0.25s ease both; transition: box-shadow 0.2s; }
  .stop-card:hover { box-shadow: var(--shadow); }
  .stop-card-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1.5px solid var(--border); background: var(--surface); }
  .stop-num { width: 26px; height: 26px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: 'Inter', sans-serif; }
  .stop-city { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 800; letter-spacing: -0.2px; }
  .stop-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
  .stop-body { padding: 14px; }
  .stop-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 8px; margin-top: 12px; }
  .stop-section-label:first-child { margin-top: 0; }
  .item-row { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 9px; cursor: pointer; transition: background 0.12s; margin-bottom: 4px; border: 1.5px solid var(--border); background: var(--surface); }
  .item-row:hover { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.12); }
  .item-info { flex: 1; }
  .item-name { font-size: 13.5px; font-weight: 600; }
  .item-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
  .item-price { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 800; flex-shrink: 0; }
  .item-time { font-size: 11.5px; font-weight: 600; color: var(--accent2); flex-shrink: 0; }
  .stop-actions { display: flex; gap: 7px; margin-top: 12px; }
  .action-btn { flex: 1; padding: 8px 0; border-radius: 9px; border: 1.5px solid var(--border); background: var(--surface); font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--ink); transition: all 0.14s; }
  .action-btn:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.15); }
  .action-btn-primary { background: var(--brand); color: #fff; border-color: var(--brand); }
  .action-btn-primary:hover { background: var(--brand-hover); border-color: var(--brand-hover); }
  .section-sep { height: 1px; background: var(--border); margin: 6px 0 16px; }
  .results-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .results-back { background: none; border: none; cursor: pointer; font-size: 12px; color: var(--muted); padding: 0; font-weight: 500; }
  .results-back:hover { color: var(--ink); }
  .results-route { flex: 1; font-family: 'Inter', sans-serif; font-weight: 700; font-size: 13px; text-align: center; letter-spacing: -0.02em; }
  .results-save { background: var(--brand); color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.2s var(--ease); }
  .results-save:hover { background: var(--brand-hover); }
  .stops-panel-head { margin-bottom: 16px; }
  .stops-panel-title { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 18px; letter-spacing: -0.03em; margin-bottom: 4px; }
  .stops-panel-sub { font-size: 13px; color: var(--muted); line-height: 1.5; }
  .stops-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 10px; }
  .filter-tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
  .filter-tab { padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 600; border: 1px solid var(--border); cursor: pointer; background: transparent; color: var(--muted); transition: all 0.2s var(--ease); font-family: 'Inter', sans-serif; }
  .filter-tab:hover { border-color: #cbd5e1; color: var(--ink); }
  .filter-tab.active { background: var(--ink); color: #fff; border-color: var(--ink); }
  .road-stop-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .road-cat-badge { width: 40px; height: 24px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; letter-spacing: 0.05em; flex-shrink: 0; }
  .road-cat-badge.cat-fuel { background: rgba(29,78,216,0.12); color: var(--brand); }
  .road-cat-badge.cat-food { background: rgba(16,185,129,0.12); color: #059669; }
  .road-cat-badge.cat-charging { background: rgba(14,165,233,0.12); color: #0284c7; }
  .road-cat-badge.cat-rest { background: rgba(100,116,139,0.12); color: var(--muted); }
  .road-stop-info { flex: 1; min-width: 0; }
  .road-stop-name { font-weight: 700; font-size: 14px; letter-spacing: -0.01em; }
  .road-stop-loc, .road-stop-note { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.4; }
  .road-stop-eta { font-size: 12px; color: var(--muted); flex-shrink: 0; font-weight: 500; }
  .stop-card-actions { padding: 0 14px 14px; display: flex; gap: 8px; }
  .stop-pin { width: 8px; height: 8px; border-radius: 50%; background: var(--brand); flex-shrink: 0; margin-top: 6px; }
  .stop-why { font-size: 11px; color: var(--muted); font-style: italic; max-width: 88px; text-align: right; line-height: 1.35; }
  .stop-section { padding: 12px 16px 0; }
  .stop-section-head { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .badge { display: inline-flex; align-items: center; justify-content: center; padding: 3px 8px; border-radius: 6px; font-size: 8px; font-weight: 800; letter-spacing: 0.05em; }
  .badge-hotel { background: var(--brand-soft); color: var(--brand); }
  .badge-food { background: rgba(16,185,129,0.12); color: #059669; }
  .tips-card { margin-top: 16px; padding: 16px; background: var(--surface); border-radius: var(--r-lg); border: 1px solid var(--border); }
  .tip-row { display: flex; gap: 10px; margin-bottom: 8px; font-size: 13px; line-height: 1.55; }
  .tip-row:last-child { margin-bottom: 0; }
  .tip-arrow { color: var(--brand); font-weight: 700; flex-shrink: 0; }

  /* ── Share panel ── */
  .share-wrap { padding: 22px 18px; }
  .share-title { font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 900; margin-bottom: 5px; letter-spacing: -0.3px; }
  .share-sub { font-size: 13px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
  .person-row { display: flex; align-items: center; gap: 12px; padding: 11px 13px; border-radius: 10px; margin-bottom: 8px; background: var(--surface); border: 1.5px solid var(--border); }
  .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: 'Inter', sans-serif; }
  .person-name { font-size: 13.5px; font-weight: 600; }
  .person-status { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 5px; margin-top: 2px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .dot-live { background: var(--accent3); }
  .dot-pending { background: #f5a623; }

  /* ── Modal ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
  .modal { background: #fff; border-radius: 20px; padding: 24px; max-width: 360px; width: 100%; box-shadow: var(--shadow-lg); }
  .modal-title { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.3px; }
  .modal-sub { font-size: 13px; color: var(--muted); margin-bottom: 18px; }
  .grocery-list { list-style: none; margin-bottom: 12px; max-height: 160px; overflow-y: auto; }
  .grocery-item { padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; }
  .grocery-item:last-child { border-bottom: none; }
  .grocery-input-row { display: flex; gap: 7px; margin-bottom: 14px; }
  .grocery-input { flex: 1; padding: 9px 13px; border: 1.5px solid var(--border); border-radius: 9px; font-family: 'Inter', sans-serif; font-size: 14px; outline: none; }
  .grocery-input:focus { border-color: var(--ink); }
  .modal-footer { display: flex; gap: 8px; }
  .modal-btn { flex: 1; padding: 11px; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; }
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

const ROAD_STOPS_FALLBACK = [
  { location:"Amarillo, TX", distance:"180 mi", eta:"2h 45m", category:"fuel", name:"Buc-ee's", note:"120 pumps · clean restrooms · snacks" },
  { location:"Tucumcari, NM", distance:"95 mi", eta:"1h 30m", category:"food", name:"Whataburger", note:"Quick bite · drive-thru" },
  { location:"Albuquerque, NM", distance:"140 mi", eta:"2h 10m", category:"rest", name:"New Mexico Welcome Center", note:"Restrooms · picnic area" },
  { location:"Gallup, NM", distance:"200 mi", eta:"3h", category:"fuel", name:"Love's Travel Stop", note:"Fuel · coffee · parking" },
];

function normalizeRoadStop(s) {
  return {
    location: s.location || s.city || "Along route",
    distance: s.distance || "—",
    eta: s.eta || "—",
    category: ["fuel", "food", "rest", "charging"].includes(s.category) ? s.category : "rest",
    name: s.name || "Rest stop",
    note: s.note || "",
  };
}

function mapHotelStops(apiStops) {
  return apiStops.map(stop => ({
    city: stop.city || "Stop",
    distance: stop.distance || "—",
    eta: stop.eta || "—",
    why: stop.why || "",
    hotels: (stop.hotels || []).map(h => ({ name: h.name, stars: h.stars, price: h.price, pet: h.pet })),
    restaurants: (stop.restaurants || []).map(r => ({ name: r.name, cuisine: r.cuisine, rating: r.rating, time: r.time })),
  }));
}

function computeAutoTheme() {
  if (typeof window === "undefined") return "day";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const sunset = 18 * 60 + 30; // 6:30 PM
  const sunrise = 6 * 60 + 30;  // 6:30 AM
  const isNightHours = mins >= sunset || mins < sunrise;
  if (prefersDark || isNightHours) return "night";
  return "day";
}

export default function App() {
  const [view, setView] = useState("hero"); // "hero" | "app"
  const [tab, setTab] = useState("plan");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [heroOrigin, setHeroOrigin] = useState("");
  const [heroDest, setHeroDest] = useState("");
  const [heroEmail, setHeroEmail] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [timingMode, setTimingMode] = useState("leave_now");
  const [arriveByDate, setArriveByDate] = useState("");
  const [routeTimingOpen, setRouteTimingOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState("standard");
  const [mapStyleOpen, setMapStyleOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [trafficAlert, setTrafficAlert] = useState(false);
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

  function saveTripComingSoon() {
    toast_("Sign in to save trips — coming in Phase 6");
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
  const [theme, setTheme] = useState(computeAutoTheme);
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const [stepAnim, setStepAnim] = useState(null); // { answer, phase: 'pop' | 'exit' }
  const stepAnimTimer = useRef(null);

  // ── Google Maps ──
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: GOOGLE_LIBRARIES,
  });
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
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

    setRouteLoading(true);
    setTrafficAlert(false);

    const routeRequest = {
      origin: originVal,
      destination: destVal,
      travelMode: window.google.maps.TravelMode.DRIVING,
    };

    if (timingMode === "leave_now") {
      routeRequest.drivingOptions = {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      };
    } else if (timingMode === "arrive_by" && arriveByDate) {
      routeRequest.drivingOptions = {
        arrivalTime: new Date(arriveByDate),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      };
    }

    if (vehicleType === "Semi Truck" || vehicleType === "Trailer") {
      routeRequest.avoidFerries = true;
      routeRequest.avoidTolls = false;
      routeRequest.provideRouteAlternatives = true;
    }

    if (vehicleType === "RV / Camper") {
      routeRequest.avoidFerries = true;
      routeRequest.provideRouteAlternatives = true;
    }

    const service = new window.google.maps.DirectionsService();
    service.route(routeRequest, (result, status) => {
      setRouteLoading(false);
      if (status === "OK") {
        const route = result.routes[0];
        const leg = route.legs[0];
        const warnings = route.warnings || [];
        const hasTrafficDelay = warnings.some(w => /traffic|delay|congestion|slow/i.test(w))
          || route.legs.some(l => l.duration_in_traffic && l.duration_in_traffic.value > l.duration.value * 1.08);
        if (warnings.length > 0 || hasTrafficDelay) setTrafficAlert(true);

        setRouteInfo({
          distance: leg.distance.text,
          duration: leg.duration.text,
          start: leg.start_address.split(",")[0],
          end: leg.end_address.split(",")[0],
          vehicleType: vehicleType || "Car",
          trailerDetail: trailerDetail || null,
          timingMode,
          arriveBy: timingMode === "arrive_by" ? arriveByDate : null,
        });
        setOrigin(originVal);
        setDest(destVal);
        setRoutePath(route.overview_path);

        if (mapRef.current) {
          const bounds = new window.google.maps.LatLngBounds();
          route.legs[0].steps.forEach(step => {
            bounds.extend(step.start_location);
            bounds.extend(step.end_location);
          });
          mapRef.current.fitBounds(bounds, { padding: 60 });
        }
      }
    });
  }, [timingMode, arriveByDate]);

  const convoEndRef = useRef(null);
  const stopsEndRef = useRef(null);
  useEffect(()=>{ convoEndRef.current?.scrollIntoView({behavior:"smooth"}); },[qIndex, generated]);

  useEffect(()=>{
    function onScroll() { setScrolled(window.scrollY > 40); }
    window.addEventListener("scroll", onScroll);
    return ()=>window.removeEventListener("scroll", onScroll);
  },[]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setTheme(computeAutoTheme());
    mq.addEventListener("change", updateTheme);
    const interval = setInterval(updateTheme, 60_000);
    return () => {
      mq.removeEventListener("change", updateTheme);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (generated && (stops.length > 0 || roadStops.length > 0)) {
      setCardCollapsed(false);
      setTab("plan");
      requestAnimationFrame(() => {
        convoEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [generated, stops, roadStops]);

  useEffect(() => {
    if (!trafficAlert) return;
    const t = setTimeout(() => setTrafficAlert(false), 5000);
    return () => clearTimeout(t);
  }, [trafficAlert]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const typeId = mapStyle === "satellite"
      ? window.google.maps.MapTypeId.SATELLITE
      : window.google.maps.MapTypeId.ROADMAP;
    mapRef.current.setMapTypeId(typeId);
    mapRef.current.setOptions({
      styles: mapStyle === "dark" ? DARK_MAP_STYLES : mapStyle === "standard" ? STANDARD_MAP_STYLES : null,
    });
  }, [mapStyle, isLoaded]);

  function toast_(msg) { setToast(msg); setTimeout(()=>setToast(null),2400); }

  function swapHeroCities() {
    const fromVal = heroOriginRef.current?.value ?? heroOrigin;
    const toVal = heroDestRef.current?.value ?? heroDest;
    if (heroOriginRef.current) heroOriginRef.current.value = toVal;
    if (heroDestRef.current) heroDestRef.current.value = fromVal;
    setHeroOrigin(toVal);
    setHeroDest(fromVal);
  }

  function swapRouteCities() {
    const fromVal = originRef.current?.value ?? origin;
    const toVal = destRef.current?.value ?? dest;
    if (originRef.current) originRef.current.value = toVal;
    if (destRef.current) destRef.current.value = fromVal;
    setOrigin(toVal);
    setDest(fromVal);
    if (isLoaded && window.google && toVal && fromVal) fetchDirections();
  }

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
      setConvo([]);
      setConvoComplete(false);
      setGenerated(false);
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

    setConvo([]);
    setQIndex(first);
  }

  function getStepMessage() {
    if (qIndex === -2) return "Got it. Ready to generate your trip plan?";
    if (qIndex >= 0) return QUESTIONS[qIndex].ask;
    return null;
  }

  function submitAnswer(value) {
    const q = QUESTIONS[qIndex];
    const na = { ...answers, [q.id]: value };
    setAnswers(na);
    setTextInput("");
    const next = nextQ(qIndex + 1, na);
    if (next === -2) {
      setQIndex(-2);
      setConvoComplete(true);
    } else {
      setQIndex(next);
    }
  }

  function pickAnswer(value) {
    if (stepAnim) return;
    setStepAnim({ answer: value, phase: "flash" });
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    stepAnimTimer.current = setTimeout(() => {
      setStepAnim(prev => prev ? { ...prev, phase: "exit" } : null);
      stepAnimTimer.current = setTimeout(() => {
        submitAnswer(value);
        setStepAnim(null);
      }, 260);
    }, 380);
  }

  useEffect(() => () => { if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current); }, []);

  function applyFallbackTrip() {
    const isDayOrHome = answers.trip_type === "Driving home" || answers.trip_type === "Day trip" || answers.overnight === "No";
    const hours = routeInfo ? parseInt(routeInfo.duration, 10) : 10;
    if (isDayOrHome) {
      setRoadStops(ROAD_STOPS_FALLBACK);
      setStops([]);
    } else {
      const numStops = hours <= 6 ? 1 : hours <= 12 ? 2 : hours <= 20 ? 3 : 4;
      setStops(STOPS_DATA.slice(0, numStops));
      setRoadStops(ROAD_STOPS_FALLBACK.slice(0, 3).map(normalizeRoadStop));
    }
    setTripTips([
      "Check weather and road conditions before you leave",
      "Allow extra time at major interchanges",
      "Keep water and snacks within reach",
    ]);
  }

  function applyTripData(data) {
    const apiStops = Array.isArray(data.stops) ? data.stops.filter(s => s && (s.city || s.name)) : [];
    const apiRoadStops = (Array.isArray(data.road_stops) ? data.road_stops : []).map(normalizeRoadStop);

    if (apiStops.length > 0) {
      setStops(mapHotelStops(apiStops));
      setRoadStops(apiRoadStops);
    } else if (apiRoadStops.length > 0) {
      setRoadStops(apiRoadStops);
      setStops([]);
    } else {
      applyFallbackTrip();
    }
    setTripTips(Array.isArray(data.tips) && data.tips.length ? data.tips : []);
    setGenerated(true);
    setStopCategory("all");
    setTab("plan");
    setCardCollapsed(false);
  }

  async function generateTrip() {
    const tripOrigin = originRef.current?.value?.trim() || origin;
    const tripDest = destRef.current?.value?.trim() || dest;
    if (!tripOrigin || !tripDest) {
      toast_("Enter origin and destination first");
      return;
    }
    setOrigin(tripOrigin);
    setDest(tripDest);
    setLoading(true);

    if (isLoaded && window.google) {
      fetchDirections(answers.vehicle, answers.trailer_detail);
    }

    try {
      const response = await fetch("/api/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: tripOrigin,
          destination: tripDest,
          answers,
          routeInfo,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate trip");
      applyTripData(data);
    } catch (err) {
      console.error("Generate trip error:", err);
      applyFallbackTrip();
      setGenerated(true);
      setStopCategory("all");
      setTab("plan");
      setCardCollapsed(false);
    }

    setLoading(false);
    toast_("Trip planned");
  }

  function resetPlan() {
    setConvo([]); setAnswers({}); setQIndex(-1);
    setConvoComplete(false); setGenerated(false); setStops([]); setTripTips([]); setRoadStops([]); setStopCategory("all");
    setStepAnim(null);
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
  }

  const currentQ = qIndex>=0 ? QUESTIONS[qIndex] : null;

  function goBackOneQuestion() {
    const newAnswers = { ...answers };
    if (qIndex >= 0) delete newAnswers[QUESTIONS[qIndex].id];
    let prev = qIndex - 1;
    while (prev >= 0) {
      const prevQ = QUESTIONS[prev];
      if (!prevQ.onlyIf || prevQ.onlyIf(newAnswers)) {
        setAnswers(newAnswers);
        setQIndex(prev);
        setTextInput("");
        return;
      }
      prev--;
    }
  }

  function QuestionChoices() {
    if (!currentQ) return null;
    const frozen = !!stepAnim;
    const selected = stepAnim?.answer;
    const showChoices = stepAnim?.phase !== "exit";
    const mkClass = (val, extra = "") => {
      const sel = selected === val ? " qr-selected" : "";
      return `qr-btn${extra}${sel}${frozen && selected !== val ? " qr-dimmed" : ""}`;
    };
    if (!showChoices) return null;
    return (
      <div className={`question-choices${frozen ? " choices-frozen" : ""}`}>
        {qIndex > 0 && !frozen && (
          <button type="button" onClick={goBackOneQuestion} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"var(--muted)",padding:"2px 0",display:"flex",alignItems:"center",gap:4,letterSpacing:"0.04em"}}>
            ← Back
          </button>
        )}
        {currentQ.type==="yesno"&&(
          <div className="quick-replies">
            <button type="button" className={mkClass("Yes", " yes")} disabled={frozen} onClick={()=>pickAnswer("Yes")}>Yes</button>
            <button type="button" className={mkClass("No", " no")} disabled={frozen} onClick={()=>pickAnswer("No")}>No</button>
          </div>
        )}
        {currentQ.type==="choice"&&(
          <div className="quick-replies">
            {currentQ.choices.map(c=><button key={c} type="button" className={mkClass(c)} disabled={frozen} onClick={()=>pickAnswer(c)}>{c}</button>)}
          </div>
        )}
        {currentQ.type==="text"&&(
          <div className="answer-input-wrap">
            <input className="answer-input" placeholder={currentQ.placeholder} value={textInput} disabled={frozen} onChange={e=>setTextInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&textInput.trim()&&!frozen&&pickAnswer(textInput.trim())}/>
            {currentQ.skippable&&!frozen&&<button type="button" className="answer-send answer-send-muted" onClick={()=>pickAnswer("skip")}>Skip</button>}
            <button type="button" className="answer-send" disabled={frozen||!textInput.trim()} onClick={()=>textInput.trim()&&pickAnswer(textInput.trim())}>Send</button>
          </div>
        )}
      </div>
    );
  }

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

  const StopsResults = ({ showHeader = true }) => (
    <div className="results-view">
      {showHeader && (
        <>
          <div className="results-header">
            <button type="button" className="results-back" onClick={resetPlan}>← Start over</button>
            <div className="results-route">{origin} → {dest}</div>
            <button type="button" className="results-save" onClick={saveTripComingSoon}>Save</button>
          </div>
          <div className="section-sep"/>
        </>
      )}

      {roadStops.length > 0 && (
        <>
          <div className="stops-section-label">
            {isDayOrHomeTrip ? "Stops along the way" : "Road stops"}
          </div>
          <div className="filter-tabs">
            {["all","fuel","food","rest","charging"].filter(cat =>
              cat === "all" || roadStops.some(s => s.category === cat)
            ).map(cat => (
              <button key={cat} type="button" onClick={()=>setStopCategory(cat)} className={`filter-tab${stopCategory===cat?" active":""}`}>
                {cat === "all" ? "All" : cat === "fuel" ? "Fuel" : cat === "food" ? "Food" : cat === "rest" ? "Rest" : "Charging"}
              </button>
            ))}
          </div>
          {roadStops
            .filter(s => stopCategory === "all" || s.category === stopCategory)
            .map((s,i) => (
              <div key={`road-${i}`} className="stop-card road-stop-card" style={{animationDelay:i*0.07+"s"}}>
                <div className="road-stop-row">
                  <div className={`road-cat-badge cat-${s.category}`}>
                    {s.category==="fuel"?"FUEL":s.category==="food"?"FOOD":s.category==="charging"?"EV":"REST"}
                  </div>
                  <div className="road-stop-info">
                    <div className="road-stop-name">{s.name}</div>
                    <div className="road-stop-loc">{s.location} · {s.distance}</div>
                    {s.note&&<div className="road-stop-note">{s.note}</div>}
                  </div>
                  <div className="road-stop-eta">{s.eta}</div>
                </div>
                <div className="stop-card-actions">
                  <button type="button" className="action-btn action-btn-primary" onClick={()=>toast_("Added to route!")}>Add to route</button>
                  <button type="button" className="action-btn" onClick={()=>toast_("Stop added to map")}>Map</button>
                </div>
              </div>
            ))
          }
        </>
      )}

      {!isDayOrHomeTrip && stops.length > 0 && (
        <>
          <div className="filter-tabs" style={{marginTop: roadStops.length > 0 ? 16 : 0}}>
            {["all","hotel","food"].filter(cat =>
              cat === "all" ||
              (cat === "hotel" && stops.some(s => s.hotels?.length > 0)) ||
              (cat === "food" && stops.some(s => s.restaurants?.length > 0))
            ).map(cat => (
              <button key={cat} type="button" onClick={()=>setStopCategory(cat)} className={`filter-tab${stopCategory===cat?" active":""}`}>
                {cat === "all" ? "All" : cat === "hotel" ? "Hotels" : "Dining"}
              </button>
            ))}
          </div>
          {stops.map((stop,i)=>(
            <div className="stop-card" key={`hotel-${i}`} style={{animationDelay:i*0.07+"s"}}>
              <div className="stop-card-head">
                <div className="stop-pin"/>
                <div style={{flex:1}}>
                  <div className="stop-city">{stop.city}</div>
                  <div className="stop-meta">{stop.distance} · {stop.eta} drive</div>
                </div>
                {stop.why&&<div className="stop-why">{stop.why}</div>}
              </div>
              {(stopCategory==="all"||stopCategory==="hotel") && stop.hotels?.length>0&&(
                <div className="stop-section">
                  <div className="stop-section-head"><span className="badge badge-hotel">HOTEL</span> Lodging</div>
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
              {(stopCategory==="all"||stopCategory==="food") && answers.restaurants==="Yes"&&stop.restaurants?.length>0&&(
                <div className="stop-section">
                  <div className="stop-section-head"><span className="badge badge-food">FOOD</span> Dining</div>
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
              <div className="stop-card-actions">
                <button type="button" className="action-btn action-btn-primary" style={{flex:2}} onClick={()=>toast_("Hotel reserved!")}>Reserve hotel</button>
                {answers.grocery==="Yes"&&<button type="button" className="action-btn" onClick={()=>setModal({type:"grocery",city:stop.city})}>Grocery</button>}
                <button type="button" className="action-btn" onClick={()=>toast_("Stop added to map")}>Map</button>
              </div>
            </div>
          ))}
        </>
      )}

      {tripTips.length>0&&(
        <div className="tips-card">
          <div className="stops-section-label">Trip tips</div>
          {tripTips.map((tip,i)=>(
            <div key={i} className="tip-row">
              <span className="tip-arrow">→</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}
      <div ref={stopsEndRef}/>
    </div>
  );

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
            <Autocomplete onPlaceChanged={() => fetchDirections()} options={{types:["geocode","establishment"]}}>
              <input ref={originRef} className="route-input" placeholder="Starting from…" defaultValue={origin}/>
            </Autocomplete>
          ) : (
            <input className="route-input" placeholder="Starting from…" value={origin} onChange={e=>setOrigin(e.target.value)}/>
          )}
        </div>
        <div className="hero-search-divider-wrap" style={{ height: 32, width: "100%", marginLeft: 16, alignSelf: "flex-start" }}>
          <div className="route-line" style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 1.5, height: "100%", margin: 0 }} />
          <button type="button" className="hero-swap-btn" style={{ marginLeft: 20 }} onClick={swapRouteCities} aria-label="Swap origin and destination">↕</button>
        </div>
        <div className="route-input-wrap">
          <div className="route-dot dest"/>
          {isLoaded ? (
            <Autocomplete onPlaceChanged={() => fetchDirections()} options={{types:["geocode","establishment"]}}>
              <input ref={destRef} className="route-input" placeholder="Going to…" defaultValue={dest}/>
            </Autocomplete>
          ) : (
            <input className="route-input" placeholder="Going to…" value={dest} onChange={e=>setDest(e.target.value)}/>
          )}
        </div>
        <div className="route-timing-wrap">
          <button type="button" className="route-timing-btn" onClick={() => setRouteTimingOpen(o => !o)}>
            {timingMode === "leave_now" ? "Leave now" : arriveByDate ? `Arrive by ${new Date(arriveByDate).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Arrive by"} ▾
          </button>
          {routeTimingOpen && (
            <div className="timing-menu" style={{left:0}}>
              <button type="button" className={`timing-menu-item${timingMode === "leave_now" ? " active" : ""}`} onClick={() => { setTimingMode("leave_now"); setRouteTimingOpen(false); if (originRef.current?.value && destRef.current?.value) fetchDirections(); }}>Leave now</button>
              <button type="button" className={`timing-menu-item${timingMode === "arrive_by" ? " active" : ""}`} onClick={() => { setTimingMode("arrive_by"); setRouteTimingOpen(false); }}>Arrive by</button>
            </div>
          )}
          {timingMode === "arrive_by" && (
            <input
              type="datetime-local"
              className="route-arrive-picker"
              value={arriveByDate}
              min={new Date().toISOString().slice(0, 16)}
              onChange={e => { setArriveByDate(e.target.value); if (e.target.value && originRef.current?.value && destRef.current?.value) fetchDirections(); }}
              style={{marginTop:8,width:"100%",background:"rgba(255,210,140,0.08)",border:"1px solid rgba(255,210,140,0.2)",borderRadius:10,padding:"10px 12px",fontFamily:"Inter,sans-serif",fontSize:13}}
            />
          )}
        </div>
      </div>
      <div className="convo-wrap">
        {/* RESULTS VIEW — shown after generating */}
        {generated ? (
          (stops.length > 0 || roadStops.length > 0) ? (
            <StopsResults />
          ) : (
            <div className="empty-state" style={{padding:"40px 16px"}}>
              <div className="empty-title">No stops returned</div>
              <div className="empty-sub" style={{marginBottom:16}}>Something went wrong loading your plan. Try generating again.</div>
              <button type="button" className="btn-generate" style={{width:"auto",padding:"10px 24px",display:"inline-block"}} onClick={()=>{ setGenerated(false); generateTrip(); }}>Try again</button>
            </div>
          )
        ) : (
          /* Step-by-step planner — one question at a time */
          <div className="plan-view">
            {qIndex === -1 && (
              <div className="convo-empty">
                <p>Enter your route above, then tap below to get started.</p>
                <button type="button" className="btn-generate btn-generate-inline" onClick={startConvo}>Start planning</button>
              </div>
            )}
            {(qIndex >= 0 || qIndex === -2) && (
              <div className={`ai-msg step-active${stepAnim?.phase === "exit" ? " step-exit" : ""}`} key={qIndex}>
                {qIndex >= 0 && routeInfo && (
                  <div className="plan-route-hint">{routeInfo.distance} · {routeInfo.duration} drive</div>
                )}
                <div className="ai-bubble">{getStepMessage()}</div>
                {qIndex >= 0 && <QuestionChoices />}
                {qIndex === -2 && (
                  <div className="question-choices" style={{borderTop:"none",paddingTop:16,marginTop:16}}>
                    <SummaryCard/>
                  </div>
                )}
              </div>
            )}
            <div ref={convoEndRef}/>
          </div>
        )}
      </div>
      {convoComplete&&(
        <div className="generate-wrap">
          <button type="button" className="btn-generate" onClick={generateTrip} disabled={loading||generated}>
            {loading?<><span className="spinner"/>Planning your trip…</>:generated?"Trip Planned ✓":"Generate Trip Plan"}
          </button>
        </div>
      )}
    </div>
  );

  const TripsPanel = () => (
    <div className="stops-wrap">
      <div className="stops-panel-head">
        <h2 className="stops-panel-title">Trips</h2>
        <p className="stops-panel-sub">Your saved trips will appear here.</p>
      </div>
      {savedTrips.length > 0 ? (
        savedTrips.map(trip => (
          <div key={trip.id} className="stop-card" style={{marginBottom:10}}>
            <div className="stop-card-head">
              <div style={{flex:1}}>
                <div className="stop-city">{trip.origin} → {trip.dest}</div>
                <div className="stop-meta">{trip.date} · {trip.stops?.length || 0} stop{(trip.stops?.length || 0) !== 1 ? "s" : ""} · {trip.routeInfo?.distance || ""}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button type="button" className="action-btn" style={{flex:"none",padding:"4px 10px",fontSize:11}} onClick={() => {
                  setOrigin(trip.origin);
                  setDest(trip.dest);
                  setStops(trip.stops || []);
                  setTripTips(trip.tripTips || []);
                  setAnswers(trip.answers || {});
                  setGenerated(true);
                  setConvoComplete(true);
                  setTab("plan");
                  toast_("Trip loaded");
                }}>View</button>
                <button type="button" className="action-btn" style={{flex:"none",padding:"4px 10px",fontSize:11,color:"var(--danger)",borderColor:"var(--danger)"}} onClick={() => deleteSavedTrip(trip.id)}>✕</button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">🗺️</div>
          <div className="empty-title">No saved trips yet</div>
          <div className="empty-sub">Your saved trips will appear here. Sign in to save your trips.</div>
          <button type="button" className="empty-cta" onClick={() => { setTab("plan"); setCardCollapsed(false); }}>Plan a trip</button>
        </div>
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
      <nav className="nav transparent">
        <div className="nav-logo">Trip<span>Mappa</span></div>
        <div className="nav-right">
          <button type="button" className="nav-btn nav-btn-ghost" onClick={()=>setView("app")}>Log in</button>
          <button type="button" className="nav-btn nav-btn-signup" onClick={()=>setView("app")}>Sign up</button>
        </div>
      </nav>

      {/* Hero */}
      <div className={`hero ${theme}`}>
        <div
          className="hero-bg"
          style={{
            backgroundImage: `url(${HERO_PHOTO_DAY})`,
            opacity: theme === "day" ? 1 : 0,
          }}
        />
        <div
          className="hero-bg"
          style={{
            backgroundImage: `url(${HERO_PHOTO_NIGHT})`,
            opacity: theme === "night" ? 1 : 0,
          }}
        />
        <div className="hero-overlay" />

        <div className="hero-content">
          <h1 className="hero-title">
            Travel<br/>
            <span className="highlight">Reimagined.</span>
          </h1>

          <p className="hero-sub">Your next trip, planned in seconds.</p>

          {/* Search bar */}
          <div className="hero-search">
            <div className="hero-search-fields">
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
              <div className="hero-search-divider-wrap">
                <div className="hero-search-divider"/>
                <button type="button" className="hero-swap-btn" onClick={swapHeroCities} aria-label="Swap origin and destination">↕</button>
              </div>
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
            </div>
            <button className="hero-go-btn" onClick={launchFromHero}>Plan my trip →</button>
          </div>

          {/* Social sign in */}
          <div className="hero-auth">
            <div className="hero-auth-label">Sign up with</div>
            <div className="hero-auth-btns">
              <button type="button" className="hero-auth-btn" onClick={()=>setView("app")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </button>
              <button type="button" className="hero-auth-btn" onClick={()=>setView("app")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </button>
              <button type="button" className="hero-auth-btn" onClick={()=>setView("app")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Apple
              </button>
            </div>
            <div className="hero-auth-or"><span>or</span></div>
            <div className="hero-email-form">
              <button type="button" className="hero-email-btn" onClick={() => setShowEmailModal(true)}>
                Continue with email
              </button>
            </div>
          </div>

        </div>

        <div className="scroll-indicator">
          <div className="scroll-arrow"/>
        </div>
      </div>

      {showEmailModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowEmailModal(false); }}>
          <div className="modal">
            <div className="modal-title">Continue with email</div>
            <div className="modal-sub">Enter your email to create your TripMappa account.</div>
            <input
              type="email"
              className="grocery-input"
              placeholder="you@example.com"
              value={heroEmail}
              onChange={e => setHeroEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && heroEmail.trim() && (setShowEmailModal(false), setView("app"))}
              style={{width:"100%",marginBottom:14,padding:"12px 14px",borderRadius:10}}
            />
            <div className="modal-footer">
              <button type="button" className="modal-btn modal-btn-outline" onClick={() => setShowEmailModal(false)}>Cancel</button>
              <button type="button" className="modal-btn modal-btn-primary" onClick={() => { if (heroEmail.trim()) { setShowEmailModal(false); setView("app"); } else toast_("Enter your email"); }}>Continue</button>
            </div>
          </div>
        </div>
      )}
      {toast&&<div className="toast">{toast}</div>}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <style>{`
        /* ── App theme: Day ── */
        .app-wrap.day .nav-app { background: rgba(12,18,34,0.94); border-bottom: 1px solid rgba(255,255,255,0.08); transition: background 1.8s ease, border-color 1.8s ease; }
        .app-wrap.day .nav-app .nav-logo { color: #fff; }
        .app-wrap.day .nav-app .nav-logo span { color: rgba(255,210,140,0.9); }
        .app-wrap.day .nav-app .nav-tab { color: rgba(255,255,255,0.5); }
        .app-wrap.day .nav-app .nav-tab.active { background: rgba(255,255,255,0.12); color: #fff; box-shadow: none; }
        .nav-app .nav-btn { color: rgba(255,255,255,0.55); }
        .app-wrap.day .nav-app .nav-btn { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85) !important; }
        .app-wrap.day .nav-app .nav-btn-primary { background: rgba(255,210,140,0.9); color: var(--charcoal) !important; border-color: transparent; font-weight: 700; }
        .app-wrap.day .nav-center-wrap { background: rgba(255,255,255,0.08); }
        .app-wrap.day .chat-title { color: var(--charcoal); }
        .app-wrap.day .chat-sub { color: #6b7280; }
        .app-wrap.day .route-input { background: rgba(255,255,255,0.92); border-color: rgba(120,160,180,0.2); color: var(--charcoal); border-radius: 12px; }
        .app-wrap.day .ai-bubble {
          background: rgba(255, 255, 255, 0.94); border-color: rgba(255,255,255,0.98);
          color: var(--charcoal); box-shadow: 0 4px 18px rgba(30, 100, 140, 0.07);
        }
        .app-wrap.day .user-bubble {
          background: linear-gradient(165deg, #1a2332 0%, #0c1222 100%); color: #fff;
          box-shadow: 0 6px 24px rgba(12,18,34,0.22);
        }
        .app-wrap.day .qr-btn {
          background: rgba(255,255,255,0.88); border-color: rgba(0,0,0,0.07); color: #1a2332;
          box-shadow: 0 3px 12px rgba(30,80,50,0.07);
        }
        .app-wrap.day .qr-btn:hover { background: #fff; border-color: rgba(255,210,140,0.4); }
        .app-wrap.day .btn-generate-app { background: #0f1923; color: #fff; }
        .app-wrap.day .map-placeholder-text { color: rgba(0,0,0,0.2); }
        .app-wrap.day .convo-wrap,
        .app-wrap.day .chat-header,
        .app-wrap.day .route-wrap,
        .app-wrap.day .generate-wrap,
        .app-wrap.day .stops-wrap { background: transparent !important; }
        .app-wrap.day .chat-header { border-bottom-color: rgba(0,0,0,0.05); }
        .app-wrap.day .route-wrap { border-bottom-color: rgba(0,0,0,0.05); }
        .app-wrap.day .plan-route-hint { background: rgba(255,210,140,0.14); color: rgba(12,18,34,0.7); border: 1px solid rgba(255,210,140,0.2); }

        /* ── App theme: Night ── */
        .app-wrap.night .nav-app { background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.08); transition: background 1.8s ease, border-color 1.8s ease; }
        .app-wrap.night .nav-app .nav-logo { color: #fff; }
        .app-wrap.night .nav-app .nav-logo span { color: rgba(255,210,140,0.9); }
        .app-wrap.night .nav-center-wrap { background: rgba(255,255,255,0.08); }
        .app-wrap.night .nav-app .nav-tab { color: rgba(255,255,255,0.45); }
        .app-wrap.night .nav-app .nav-tab.active { background: rgba(255,255,255,0.15); color: #fff; box-shadow: none; }
        .app-wrap.night .nav-app .nav-btn { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.85) !important; }
        .app-wrap.night .nav-app .nav-btn-primary { background: var(--charcoal); color: #fff !important; border-color: rgba(255,255,255,0.15); }
        .app-wrap.night .float-card .route-input { color: #fff !important; }
        .app-wrap.night .float-card .route-input::placeholder { color: rgba(255,255,255,0.35) !important; }
        .app-wrap.night .route-loading-pill {
          background: rgba(8,14,38,0.95); border-color: rgba(255,255,255,0.1); color: #fff;
        }
        .app-wrap.night .spinner-dark {
          border-color: rgba(255,255,255,0.15); border-top-color: rgba(255,210,140,0.9);
        }
        .app-wrap.night .empty-icon { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
        .app-wrap.night .empty-cta { background: var(--charcoal); color: #fff; }
        .pac-container { z-index: 100000 !important; }
        .app-wrap.night .pac-container { background: #0d1935 !important; border-color: rgba(255,255,255,0.12) !important; }
        .app-wrap.night .pac-item { border-top-color: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .app-wrap.night .pac-item:hover, .app-wrap.night .pac-item-selected { background: rgba(255,255,255,0.08) !important; }
        .app-wrap.night .pac-item-query { color: #fff !important; }
        .app-wrap.night .chat-title { color: #fff; }
        .app-wrap.night .chat-sub { color: rgba(255,255,255,0.45); }
        .app-wrap.night .route-wrap { border-bottom: 1px solid rgba(255,255,255,0.07); }
        .app-wrap.night .results-view { color: #fff; }
        .app-wrap.night .results-view .stop-city { color: #fff; }
        .app-wrap.night .results-view .stop-meta { color: rgba(255,255,255,0.5); }
        .app-wrap.night .route-input { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.1) !important; color: #ffffff !important; }
        .app-wrap.night .route-input::placeholder { color: rgba(255,255,255,0.25); }
        .app-wrap.night .route-line { background: rgba(255,255,255,0.1); }
        .app-wrap.night .route-dot { background: #fff; }
        .app-wrap.night .route-dot.dest { background: rgba(255,210,140,0.9) !important; }
        .app-wrap.night .convo-wrap { background: transparent !important; }
        .app-wrap.night .ai-name { color: rgba(255,255,255,0.35); }
        .app-wrap.night .ai-bubble {
          background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.95);
          box-shadow: 0 4px 24px rgba(0,0,0,0.2);
        }
        .app-wrap.night .user-bubble {
          background: linear-gradient(165deg, #1a2332 0%, #0c1222 100%); color: #fff;
          box-shadow: 0 6px 24px rgba(0,0,0,0.35);
        }
        .app-wrap.night .qr-btn {
          background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.92);
          box-shadow: 0 3px 12px rgba(0,0,0,0.2);
        }
        .app-wrap.night .qr-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }
        .app-wrap.night .qr-btn.yes { border-color: rgba(255,210,140,0.35); color: rgba(255,210,140,0.9); }
        .app-wrap.night .qr-btn.yes:hover { background: rgba(255,210,140,0.15); color: #fff; }
        .app-wrap.night .qr-btn.no { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
        .app-wrap.night .qr-btn.no:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .app-wrap.night .answer-input { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); color: #fff; }
        .app-wrap.night .answer-input::placeholder { color: rgba(255,255,255,0.25); }
        .app-wrap.night .answer-send { background: linear-gradient(180deg, #1a2332 0%, #0c1222 100%); }
        .app-wrap.night .answer-send-muted { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.55) !important; border-color: rgba(255,255,255,0.1) !important; }
        .app-wrap.night .summary-card { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); color: #fff; }
        .app-wrap.night .summary-key { color: rgba(255,255,255,0.4); letter-spacing: 0.08em; }
        .app-wrap.night .generate-wrap { border-top-color: rgba(255,255,255,0.06); background: transparent !important; }
        .app-wrap.night .plan-route-hint { background: rgba(255,210,140,0.1); color: rgba(255,255,255,0.75); border: 1px solid rgba(255,210,140,0.15); }
        .app-wrap.night .chat-header { background: transparent !important; border-bottom-color: rgba(255,255,255,0.06); }
        .app-wrap.night .chat-wrap { background: transparent; }
        .app-wrap.night .route-wrap { background: transparent !important; border-bottom-color: rgba(255,255,255,0.06); }
        .app-wrap.night .map-placeholder-text { color: rgba(255,255,255,0.2); }
        .app-wrap.night .map-placeholder-sub { color: rgba(255,255,255,0.12); }
        .app-wrap.night .stop-card { background: #0d1935; border-color: rgba(255,255,255,0.08); }
        .app-wrap.night .stop-card-head { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.06) !important; }
        .app-wrap.night .item-row { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.07) !important; }
        .app-wrap.night .stop-city { color: #fff; }
        .app-wrap.night .stop-meta { color: rgba(255,255,255,0.4); }
        .app-wrap.night .stop-num { background: rgba(255,210,140,0.9); color: var(--charcoal); }
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
        .app-wrap.night .filter-tab { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.15) !important; color: rgba(255,255,255,0.7) !important; }
        .app-wrap.night .filter-tab.active { background: #fff !important; color: var(--ink) !important; border-color: #fff !important; }
        .app-wrap.night .action-btn:hover { background: rgba(255,255,255,0.13); }
        .app-wrap.night .action-btn-primary { background: var(--charcoal); border-color: var(--charcoal); }
        .app-wrap.night .section-sep { background: rgba(255,255,255,0.07); }
        .app-wrap.night .empty-title { color: #fff; }
        .app-wrap.night .empty-sub { color: rgba(255,255,255,0.4); }
        .app-wrap.night .stops-wrap { color: #fff; }
        .app-wrap.night .stops-wrap h2, .app-wrap.night .stops-wrap div { color: inherit; }
        .app-wrap.night .share-title { color: #fff; }
        .app-wrap.night .share-sub { color: rgba(255,255,255,0.4); }
        .app-wrap.night .person-row { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }
        .app-wrap.night .person-name { color: #fff; }
        .app-wrap.night .person-status { color: rgba(255,255,255,0.4); }
        .app-wrap.night .stops-wrap { background: transparent !important; color: #fff; }
        .app-wrap.day .stops-wrap { background: transparent !important; }

        /* Sidebar — transparent so frosted float-card shows through */
        .app-wrap.day .sidebar-inner {
          background: transparent !important;
          border-right: none !important;
        }
        .app-wrap.night .sidebar-inner {
          background: transparent !important;
          border-right: none !important;
        }
        .app-wrap.day .sidebar-inner::after,
        .app-wrap.night .sidebar-inner::before,
        .app-wrap.night .sidebar-inner::after { display: none; }

        /* Float card — frosted glass */
        .app-wrap.day .float-card {
          background: rgba(255, 253, 250, 0.82) !important;
          backdrop-filter: blur(32px) saturate(1.5) !important;
          -webkit-backdrop-filter: blur(32px) saturate(1.5) !important;
          border: 1px solid rgba(255,255,255,0.75) !important;
          box-shadow: 0 24px 56px rgba(30, 100, 140, 0.12), 0 8px 24px rgba(20, 80, 120, 0.06), inset 0 1px 0 rgba(255,255,255,0.92) !important;
        }
        .app-wrap.night .float-card {
          background: rgba(8, 14, 32, 0.84) !important;
          backdrop-filter: blur(32px) saturate(1.4) !important;
          -webkit-backdrop-filter: blur(32px) saturate(1.4) !important;
          border: 1px solid rgba(255,210,140,0.1) !important;
          box-shadow: 0 24px 64px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,210,140,0.05) !important;
        }

        /* Logo — Trip white, Mappa gold everywhere */
        .app-wrap .nav-logo { color: #fff !important; }
        .app-wrap .nav-logo span { color: rgba(255,210,140,0.9) !important; }

        /* Route dots */
        .app-wrap.night .route-dot { background: rgba(255,255,255,0.7) !important; }
        .app-wrap.night .route-dot.dest { background: rgba(255,210,140,0.9) !important; }
        .app-wrap.day .route-dot { background: #0f1923 !important; }
        .app-wrap.day .route-dot.dest { background: rgba(255,210,140,0.9) !important; }

        .app-wrap.night .chat-wrap, .app-wrap.night .stops-wrap, .app-wrap.night .share-wrap,
        .app-wrap.day .chat-wrap, .app-wrap.day .stops-wrap, .app-wrap.day .share-wrap { position: relative; z-index: 1; }

        .app-wrap.night .fuel-row { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.07); }
        .app-wrap.night .fuel-label { color: #fff; }
        .app-wrap.night .fuel-meta-txt { color: rgba(255,255,255,0.4); }
        .app-wrap.night .btn-generate { background: linear-gradient(180deg, #1a2332 0%, #0c1222 100%); }

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
        .app-wrap .map-day-layer { background: linear-gradient(150deg, #dceef8 0%, #d4ebe0 55%, #c8dcc8 100%); }
        .app-wrap .map-night-layer { background: linear-gradient(150deg, #040810 0%, #0a1428 50%, #1a2030 100%); }
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
        .app-wrap.day { --ink: var(--charcoal); --surface: #f4faf8; --card: #ffffff; --border: rgba(120,160,180,0.15); --muted: #6b7280; }
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

      <div className={`app-wrap ${theme}`} style={{
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
            <button className="nav-btn" onClick={saveTripComingSoon}>Save trip</button>
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
                    mapTypeId: mapStyle === "satellite" ? "satellite" : "roadmap",
                    styles: mapStyle === "dark" ? DARK_MAP_STYLES : mapStyle === "standard" ? STANDARD_MAP_STYLES : undefined,
                  }}
                >
                  {routePath && (() => {
                    if (mapRef.current) {
                      if (polylineRef.current) polylineRef.current.setMap(null);
                      const color = routeInfo?.vehicleType === "Semi Truck" || routeInfo?.vehicleType === "Trailer"
                        ? "rgba(255,210,140,0.85)"
                        : routeInfo?.vehicleType === "RV / Camper"
                        ? "rgba(255,210,140,0.75)"
                        : "rgba(255,210,140,0.9)";
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
                {trafficAlert && (
                  <div className="traffic-toast">
                    <span className="traffic-toast-icon">⚠</span>
                    Traffic delays detected on your route
                  </div>
                )}
                <div className="map-style-toggle">
                  <button type="button" className="map-style-btn" onClick={() => setMapStyleOpen(o => !o)} aria-label="Map style">🗺</button>
                  {mapStyleOpen && (
                    <div className="map-style-menu">
                      {[["standard","Standard"],["satellite","Satellite"],["dark","Dark"]].map(([k,l]) => (
                        <button key={k} type="button" className={`map-style-item${mapStyle === k ? " active" : ""}`} onClick={() => { setMapStyle(k); setMapStyleOpen(false); }}>{l}</button>
                      ))}
                    </div>
                  )}
                </div>
                {routeInfo && (
                  <div className="route-info-bar">
                    <div className="rib-item"><div className="rib-val">{routeInfo.distance}</div><div className="rib-label">Distance</div></div>
                    <div className="rib-divider"/>
                    <div className="rib-item"><div className="rib-val">{routeInfo.duration}</div><div className="rib-label">Drive Time</div></div>
                    <div className="rib-divider rib-divider-mobile-hide"/>
                    <div className="rib-item rib-item-route">
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
                        <div className="rib-divider rib-divider-mobile-hide"/>
                        <div className="rib-item rib-item-badge">
                          <div className="rib-val" style={{fontSize:10,color:"#4a9fd4"}}>TRUCK SAFE</div>
                          <div className="rib-label">Avoids restrictions</div>
                        </div>
                      </>
                    )}
                    {routeInfo.vehicleType === "RV / Camper" && (
                      <>
                        <div className="rib-divider rib-divider-mobile-hide"/>
                        <div className="rib-item rib-item-badge">
                          <div className="rib-val" style={{fontSize:10,color:"#2abf6e"}}>RV FRIENDLY</div>
                          <div className="rib-label">RV optimized</div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="map-loading">
                <div className="loading-spinner"/>
                <div className="map-placeholder-text">Loading map…</div>
                <div className="map-placeholder-sub">Connecting to Google Maps</div>
                <div className="map-loading-skeleton" aria-hidden="true">
                  <div className="map-skeleton-bar"/>
                  <div className="map-skeleton-bar"/>
                  <div className="map-skeleton-bar"/>
                </div>
              </div>
            )}
            {isLoaded && routeLoading && (
              <div className="route-loading-pill">
                <span className="spinner-dark"/>
                Calculating route…
              </div>
            )}
          </div>

          {/* Floating glass card */}
          <div className={`float-card ${theme} ${cardCollapsed?"collapsed":""}`}>
            <div className="float-card-header" onClick={()=>setCardCollapsed(c=>!c)}>
              <div className="float-card-handle" aria-hidden="true"/>
              <div className="float-card-header-row">
                <div className="float-card-title" style={{color: theme==="night"?"#fff":"var(--ink)"}}>
                  {tab==="plan"?"Plan Your Trip":tab==="trips"?"Trips":"Live Sharing"}
                </div>
                <div className="float-card-header-actions" onClick={e => e.stopPropagation()}>
                  <div className="float-card-help-wrap">
                    <button type="button" className="float-card-help-btn" onClick={() => setHelpMenuOpen(o => !o)} aria-label="Help">?</button>
                    {helpMenuOpen && (
                      <div className="help-menu">
                        <button type="button" className="help-menu-item" onClick={() => { window.open("https://tripmappa.com/help", "_blank"); setHelpMenuOpen(false); }}>Help center</button>
                        <button type="button" className="help-menu-item" onClick={() => { setModal({ type: "report" }); setHelpMenuOpen(false); }}>Report an issue</button>
                      </div>
                    )}
                  </div>
                  <span className={`float-card-chevron ${cardCollapsed?"":"open"}`}>▼</span>
                </div>
              </div>
            </div>
            <div className="float-card-body">
              <div className="float-card-scroll">
                <div className="sidebar-inner" style={{background:"transparent"}}>
                  {tab==="plan"&&planPanel}
                  {tab==="trips"&&<TripsPanel/>}
                  {tab==="share"&&<SharePanel/>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modal?.type==="grocery"&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <GroceryModal city={modal.city}/>
        </div>
      )}
      {modal?.type==="report"&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div className="modal">
            <div className="modal-title">Report an issue</div>
            <div className="modal-sub">Tell us what went wrong and we&apos;ll look into it.</div>
            <textarea
              className="report-textarea"
              placeholder="Describe the issue…"
              value={reportText}
              onChange={e => setReportText(e.target.value)}
            />
            <div className="modal-footer">
              <button type="button" className="modal-btn modal-btn-outline" onClick={() => { setModal(null); setReportText(""); }}>Cancel</button>
              <button type="button" className="modal-btn modal-btn-primary" onClick={() => { toast_("Thanks — we'll review your report"); setModal(null); setReportText(""); }}>Submit</button>
            </div>
          </div>
        </div>
      )}
      {toast&&<div className="toast">{toast}</div>}
    </>
  );
}
