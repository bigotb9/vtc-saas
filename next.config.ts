import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "iixpsfsqyfnllggvsvfl.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  org:             process.env.SENTRY_ORG,
  project:         process.env.SENTRY_PROJECT,
  silent:          true,          // pas de logs Sentry pendant le build
  disableLogger:   true,
  sourcemaps:      { disable: true },   // ne pas exposer les source maps en prod
  widenClientFileUpload: true,
  // Désactive l'upload des source maps si DSN absent (dev sans config)
  ...(process.env.NEXT_PUBLIC_SENTRY_DSN ? {} : { sourcemaps: { disable: true } }),
})
