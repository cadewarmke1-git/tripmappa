/**
 * Export Playwright storageState from a signed-in TripMappa session.
 * Run with dev server up: npm run dev -- --host 127.0.0.1 --port 5173
 *
 * Usage:
 *   node scripts/export-playwright-auth.mjs
 *
 * Sign-in order:
 *   1. Email + password for tripmappa@gmail.com (PLAYWRIGHT_ADMIN_PASSWORD in .env.local)
 *      — uses AuthContext signInWithPassword via the Sign In modal (no production code changes).
 *   2. Fallback: real Chrome persistent profile for manual Google OAuth
 *      — close Google Chrome first if launch fails (profile lock).
 *
 * Env (optional):
 *   PLAYWRIGHT_ADMIN_EMAIL — default tripmappa@gmail.com
 *   PLAYWRIGHT_ADMIN_PASSWORD — password for the Playwright admin account
 *   CHROME_EXECUTABLE_PATH — path to chrome.exe
 *   CHROME_USER_DATA_DIR — Chrome "User Data" root (not the Default subfolder)
 *   CHROME_PROFILE — profile folder name (default: Default)
 *   VERIFY_BASE_URL — default http://127.0.0.1:5173
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

const BASE = process.env.VERIFY_BASE_URL || "http://127.0.0.1:5173";
const OUT = path.join(process.cwd(), "e2e", ".auth", "user.json");
const DEFAULT_PLAYWRIGHT_ADMIN_EMAIL = "tripmappa@gmail.com";

const DEFAULT_CHROME_EXECUTABLES = [
  path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function resolveChromeExecutable() {
  const fromEnv = (process.env.CHROME_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROME_EXECUTABLE)?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  if (fromEnv) {
    console.warn(`CHROME_EXECUTABLE_PATH not found: ${fromEnv} — falling back to channel "chrome".`);
  }
  return DEFAULT_CHROME_EXECUTABLES.find(p => fs.existsSync(p));
}

function resolveChromeUserDataRoot() {
  const fromEnv = (process.env.CHROME_USER_DATA_DIR || process.env.PLAYWRIGHT_CHROME_USER_DATA_DIR)?.trim();
  if (fromEnv) return fromEnv;
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "Google", "Chrome", "User Data");
}

function resolveChromeProfileName() {
  return (process.env.CHROME_PROFILE || process.env.PLAYWRIGHT_CHROME_PROFILE)?.trim() || "Default";
}

async function isSignedInOnLocalhost(page) {
  if (!/127\.0\.0\.1|localhost/.test(page.url())) return false;
  const trigger = page.locator(".profile-card-trigger").first();
  if (!(await trigger.isVisible().catch(() => false))) return false;
  await trigger.click();
  const signedIn = await page.locator(".profile-card-signout").isVisible().catch(() => false);
  if (!signedIn) await page.keyboard.press("Escape");
  return signedIn;
}

async function openSignInModal(page) {
  const trigger = page.locator(".profile-card-trigger").first();
  await trigger.waitFor({ state: "visible", timeout: 30_000 });
  await trigger.click();
  // NavProfileMenu label is "Sign in" (lowercase i)
  const signIn = page.getByRole("button", { name: /^sign in$/i }).first();
  await signIn.waitFor({ state: "visible", timeout: 10_000 });
  await signIn.click();
}

/** Email/password via SignInModal — matches AuthContext.signIn → signInWithPassword. */
async function tryEmailPasswordSignIn(page, email, password) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  if (await isSignedInOnLocalhost(page)) {
    console.log("Already signed in on localhost.");
    return true;
  }

  await openSignInModal(page);
  await page.locator(".auth-modal, dialog.auth-modal-overlay").first().waitFor({ state: "attached", timeout: 20_000 });
  const emailInput = page.locator("#signin-email");
  await emailInput.waitFor({ state: "attached", timeout: 20_000 });
  // Native <dialog> can confuse visibility checks — fill attached inputs directly.
  await emailInput.fill(email, { force: true });
  await page.locator("#signin-password").fill(password, { force: true });
  await page.locator(".auth-modal-submit, button[type=submit]").filter({ hasText: /Sign In/i }).first().click({ force: true });

  try {
    await page.locator(".auth-modal, dialog.auth-modal-overlay").first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => null);
    await page.waitForTimeout(1500);
    await page.locator(".profile-card-trigger").first().click();
    await page.locator(".profile-card-signout").waitFor({ state: "visible", timeout: 15_000 });
    return true;
  } catch {
    const authError = await page.locator(".auth-modal-error").textContent().catch(() => "");
    if (authError) console.error(`Sign-in error: ${authError.trim()}`);
    return false;
  }
}

async function launchEphemeralContext() {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--start-maximized"],
  });
  const context = await browser.newContext();
  return {
    mode: "ephemeral",
    browser,
    context,
    async close() {
      await browser.close();
    },
  };
}

/** Real installed Chrome + persistent user profile (trusted for Google OAuth). */
async function launchPersistentChromeContext() {
  const userDataRoot = resolveChromeUserDataRoot();
  const profileName = resolveChromeProfileName();
  const executablePath = resolveChromeExecutable();

  if (!fs.existsSync(userDataRoot)) {
    throw new Error(`Chrome user data directory not found: ${userDataRoot}`);
  }

  console.log(`Chrome executable: ${executablePath || "channel: chrome"}`);
  console.log(`Chrome user data: ${userDataRoot}`);
  console.log(`Chrome profile: ${profileName}`);
  console.log("Close Google Chrome completely before continuing if the profile is locked.\n");

  const launchOptions = {
    headless: false,
    viewport: null,
    args: [
      "--start-maximized",
      `--profile-directory=${profileName}`,
    ],
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  } else {
    launchOptions.channel = "chrome";
  }

  const context = await chromium.launchPersistentContext(userDataRoot, launchOptions);
  return {
    mode: "persistent",
    browser: null,
    context,
    async close() {
      await context.close();
    },
  };
}

async function waitForManualOAuthSignIn(page, email) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  console.log(`
Sign in on ${BASE} using Google OAuth (trusted Chrome profile) or email + password.
Waiting up to 10 minutes for signed-in profile menu on localhost…
`);
  if (email) {
    await openSignInModal(page).catch(() => {});
    await page.locator("#signin-email").fill(email).catch(() => {});
  }

  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("Browser window was closed before sign-in completed.");
    }
    if (await isSignedInOnLocalhost(page)) return;

    const url = page.url();
    if (!/127\.0\.0\.1|localhost/.test(url)) {
      console.log(`Note: on ${url.slice(0, 96)}… return to ${BASE} when done.`);
    }
    await page.waitForTimeout(2000);
  }
  throw new Error("Timed out waiting for sign-in on localhost (10 min).");
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const env = loadEnvLocal();
  const email =
    process.env.PLAYWRIGHT_ADMIN_EMAIL
    || env.PLAYWRIGHT_ADMIN_EMAIL
    || process.env.ADMIN_EMAIL
    || env.ADMIN_EMAIL
    || DEFAULT_PLAYWRIGHT_ADMIN_EMAIL;
  const password =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD
    || env.PLAYWRIGHT_ADMIN_PASSWORD
    || process.env.ADMIN_PASSWORD
    || env.ADMIN_PASSWORD
    || env.E2E_ADMIN_PASSWORD;
  const hasEmailPassword = Boolean(email && password);

  let session;

  if (hasEmailPassword) {
    console.log(`Primary: email/password sign-in for ${email}…`);
    session = await launchEphemeralContext();
    const page = await session.context.newPage();
    const signedIn = await tryEmailPasswordSignIn(page, email, password);
    if (!signedIn) {
      await session.close();
      throw new Error("Email/password sign-in failed. Check PLAYWRIGHT_ADMIN_PASSWORD in .env.local.");
    }
  } else {
    console.log("Fallback: Chrome persistent profile for manual Google OAuth…");
    if (!password) {
      console.log("No PLAYWRIGHT_ADMIN_PASSWORD in .env.local — use manual sign-in or set the password.");
    }
    session = await launchPersistentChromeContext();
    const page = session.context.pages()[0] || await session.context.newPage();
    if (await isSignedInOnLocalhost(page)) {
      console.log("Already signed in on localhost via Chrome profile.");
    } else {
      await waitForManualOAuthSignIn(page, email);
    }
  }

  try {
    await session.context.storageState({ path: OUT });
    console.log(`Saved authenticated storageState → ${OUT}`);
  } finally {
    await session.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
