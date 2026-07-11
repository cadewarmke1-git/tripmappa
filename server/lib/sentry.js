/** Lazy Sentry init for Vercel serverless API routes. */
import * as Sentry from "@sentry/node";

const DSN = "https://1c6a3daa0e336e04d6aa20824b1d08a4@o4511719041794048.ingest.us.sentry.io/4511719050051584";

let initialized = false;

export function initServerSentry() {
  if (initialized) return;
  Sentry.init({ dsn: DSN });
  initialized = true;
}

export function captureServerException(error, captureContext) {
  initServerSentry();
  Sentry.captureException(error, captureContext);
}

export { Sentry };
