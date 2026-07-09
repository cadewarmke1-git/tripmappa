import { defineConfig, devices } from "@playwright/test";

/** Production demo readiness — no local webServer. */
export default defineConfig({
  testDir: "e2e",
  testMatch: "demo-readiness.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "https://tripmappa.com",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    permissions: ["clipboard-read", "clipboard-write"],
    actionTimeout: 60_000,
  },
});
