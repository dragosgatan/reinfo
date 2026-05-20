import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      {
        source: "/avatars/:path*",
        destination: `${backend}/avatars/:path*`,
      },
    ];
  },
};

const sentryConfig = {
  org: process.env.SENTRY_ORG ?? "",
  project: process.env.SENTRY_PROJECT ?? "reinfo-frontend",
  silent: true,
  disableLogger: true,
  // Only upload source maps when SENTRY_AUTH_TOKEN is set (CI/production builds)
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
};

export default withSentryConfig(withNextIntl(nextConfig), sentryConfig);
