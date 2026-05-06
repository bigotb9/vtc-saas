"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useTenant } from "@/components/TenantProvider"

/**
 * Page de demande de reset password. Utilise Supabase Auth resetPasswordForEmail
 * qui envoie un email avec un lien de reset (via le SMTP configuré sur le
 * projet Supabase tenant).
 */

export default function ForgotPasswordPage() {
  const { tenant } = useTenant()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      const { error: rpfeErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/reset-password`,
      })
      if (rpfeErr) throw rpfeErr
      setSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060B14] px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-8">
          <ArrowLeft size={14} />
          Retour à la connexion
        </Link>

        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-400" size={36} />
              <h2 className="text-white font-bold">Email envoyé</h2>
              <p className="text-sm text-gray-400">
                Si un compte existe pour <strong className="text-gray-300">{email}</strong>, un lien
                de réinitialisation vient d&apos;être envoyé. Vérifiez votre boîte mail.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white mb-1">Mot de passe oublié</h1>
                <p className="text-sm text-gray-400">
                  Saisissez votre email — vous recevrez un lien pour définir un nouveau mot de passe.
                </p>
              </div>

              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  required
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Envoyer le lien"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          {tenant?.nom || "VTC Platform"}
        </p>
      </div>
    </div>
  )
}
