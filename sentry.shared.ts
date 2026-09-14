import type { ErrorEvent } from "@sentry/nextjs";

// Minors' data must never leave for Sentry: drop cookies, headers, query strings, request bodies and user details.
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
    delete event.request.query_string;
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  return event;
}

export const sentryBaseOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
};
