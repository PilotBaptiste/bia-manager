const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Readable stack traces in Sentry need the source maps upload, which only runs with an auth token.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  telemetry: false,
});
