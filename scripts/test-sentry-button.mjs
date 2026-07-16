/**
 * Click DevSentryTestButton and verify error + Sentry capture signals.
 * Run: node scripts/test-sentry-button.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleLogs = [];
const pageErrors = [];
const sentryRequests = [];

page.on("console", msg => {
  consoleLogs.push({ type: msg.type(), text: msg.text() });
});
page.on("pageerror", err => {
  pageErrors.push(err.message || String(err));
});
page.on("request", req => {
  const url = req.url();
  if (url.includes("ingest.us.sentry.io") || url.includes("sentry.io/api")) {
    sentryRequests.push({ url, method: req.method() });
  }
});
page.on("response", async res => {
  const url = res.url();
  if (url.includes("ingest.us.sentry.io")) {
    let body = null;
    try { body = await res.text(); } catch { /* ignore */ }
    sentryRequests.push({
      url,
      status: res.status(),
      bodyPreview: body?.slice(0, 200) || null,
    });
  }
});

await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

const button = page.locator(".dev-sentry-test-btn");
const buttonVisible = await button.isVisible({ timeout: 10_000 }).catch(() => false);

let clickResult = { clicked: false, error: null };
if (buttonVisible) {
  try {
    await button.click({ timeout: 5000 });
    clickResult.clicked = true;
  } catch (err) {
    clickResult.error = err.message;
  }
}

await page.waitForTimeout(3000);

const fallbackVisible = await page.locator(".error-boundary-fallback").isVisible({ timeout: 2000 }).catch(() => false);
const fallbackText = fallbackVisible
  ? await page.locator(".error-boundary-msg").textContent().catch(() => null)
  : null;

const sentryEventIdLog = consoleLogs.find(l =>
  /Sentry Event ID|event id|Event ID/i.test(l.text),
);
const sentryDebugLogs = consoleLogs.filter(l =>
  /sentry/i.test(l.text),
);

const report = {
  base: BASE,
  buttonVisible,
  clickResult,
  pageErrors,
  errorBoundaryVisible: fallbackVisible,
  errorBoundaryMessage: fallbackText?.trim() || null,
  errorThrown: pageErrors.some(m => /Sentry test error/i.test(m))
    || /Sentry test error/i.test(fallbackText || ""),
  sentryEventIdLog: sentryEventIdLog?.text || null,
  sentryConsoleLogs: sentryDebugLogs.map(l => l.text),
  sentryIngestRequests: sentryRequests,
  sentryCaptured: Boolean(
    sentryEventIdLog
    || sentryRequests.some(r => r.status === 200 || r.status === 201),
  ),
  allConsoleLogs: consoleLogs.map(l => l.text).filter(t => /sentry|error/i.test(t)),
};

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.sentryCaptured && report.errorThrown ? 0 : 1);
