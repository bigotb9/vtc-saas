"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useEffect } from "react"

/**
 * Initialise PostHog côté client et expose le provider React.
 *
 * Variable d'env requise : NEXT_PUBLIC_POSTHOG_KEY
 * Optional : NEXT_PUBLIC_POSTHOG_HOST (défaut: https://app.posthog.com)
 *
 * Usage dans layout.tsx : <PostHogProvider>{children}</PostHogProvider>
 */
function PostHogInit() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return

    posthog.init(key, {
      api_host:         process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      // Pas de cookies en mode EU
      persistence:      "memory",
      autocapture:      false,   // on contrôle manuellement les events
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug()
      },
    })
  }, [])
  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogInit />
      {children}
    </PHProvider>
  )
}

/**
 * Events métier à tracker. Utiliser depuis les composants client :
 *   import posthog from "posthog-js"
 *   posthog.capture("signup_started", { plan_id: "gold" })
 */
export const PHEvents = {
  // Acquisition
  SIGNUP_STARTED:         "signup_started",
  SIGNUP_PLAN_SELECTED:   "signup_plan_selected",
  PAYMENT_WAVE_CLICKED:   "payment_wave_clicked",
  PAYMENT_DECLARED:       "payment_wave_declared",

  // Activation
  TENANT_PROVISIONED:     "tenant_provisioned",
  FIRST_LOGIN:            "first_login",
  PASSWORD_SET:           "password_set",
  ONBOARDING_STEP:        "onboarding_step",

  // Usage
  VEHICLE_CREATED:        "vehicle_created",
  CHAUFFEUR_CREATED:      "chauffeur_created",
  RECETTE_IMPORTED:       "recette_imported",
  AI_INSIGHTS_VIEWED:     "ai_insights_viewed",
  YANGO_SYNCED:           "yango_synced",
  PDF_EXPORTED:           "pdf_exported",
  SYSCOHADA_EXPORTED:     "syscohada_exported",

  // Rétention
  PLAN_UPGRADED:          "plan_upgraded",
  PLAN_DOWNGRADED:        "plan_downgraded",
  SUBSCRIPTION_CANCELED:  "subscription_canceled",
  INTEGRATION_CONFIGURED: "integration_configured",
} as const
