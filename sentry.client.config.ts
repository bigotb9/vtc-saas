import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,       // 10% des transactions — ajuster selon le volume
  replaysSessionSampleRate: 0, // désactivé (coût élevé)
  replaysOnErrorSampleRate: 0,

  // N'envoie pas d'erreurs connues/banales
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error exception captured",
    /ChunkLoadError/,
  ],

  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})
