"use client"

/**
 * Error boundary spécifique à /saas/tenants/[id].
 * Affiche le message d'erreur côté UI au lieu du fallback Next.js générique
 * "Application error: a client-side exception…", pour qu'on puisse diagnostiquer
 * sans avoir besoin de la console DevTools.
 */

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log côté serveur Vercel (visible dans Functions logs)
    console.error("[saas/tenants/[id]] client error:", error)
  }, [error])

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={22} />
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Erreur sur cette page tenant</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Le composant a planté. Détails ci-dessous (à partager au support pour diagnostic).
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-red-200 dark:border-red-500/20 p-4 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Message</div>
            <div className="font-mono text-xs text-red-700 dark:text-red-300 break-all">
              {error.message || "(aucun message)"}
            </div>
          </div>

          {error.digest && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Digest</div>
              <div className="font-mono text-xs text-gray-500">{error.digest}</div>
            </div>
          )}

          {error.stack && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Stack</div>
              <pre className="font-mono text-[10px] text-gray-600 dark:text-gray-400 break-all whitespace-pre-wrap max-h-64 overflow-auto">
                {error.stack}
              </pre>
            </div>
          )}
        </div>

        <button
          onClick={reset}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium"
        >
          <RefreshCw size={14} />
          Réessayer
        </button>
      </div>
    </div>
  )
}
