"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import { Loader2 } from "lucide-react"

/**
 * Guard pour les routes /saas/* (sauf /saas/login).
 * Vérifie que :
 *  1. L'utilisateur est authentifié sur la base master
 *  2. Il existe une ligne dans saas_admins avec son user.id
 *
 * Si non, redirect vers /saas/login.
 */
export default function SaasAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<"loading" | "ok" | "nope">("loading")

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const { data: sess } = await sb.auth.getSession()
      if (!sess.session) {
        if (!cancelled) router.replace("/saas/login")
        return
      }
      const userId = sess.session.user.id
      const jwt    = sess.session.access_token

      // Validation côté serveur : la route /api/saas/me vérifie que userId ∈ saas_admins
      const res = await fetch("/api/saas/me", {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      if (!res.ok) {
        if (!cancelled) {
          await sb.auth.signOut()
          router.replace("/saas/login")
        }
        return
      }
      if (!cancelled) setState("ok")
    }

    check()
    return () => { cancelled = true }
  }, [router])

  if (state !== "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080C14]">
        <Loader2 className="animate-spin text-indigo-500" size={28} />
      </div>
    )
  }

  return <>{children}</>
}
