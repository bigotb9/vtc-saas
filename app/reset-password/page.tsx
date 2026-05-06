"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, ArrowRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

/**
 * Page de définition d'un nouveau mot de passe. L'utilisateur arrive ici
 * via le lien email de Supabase Auth (resetPasswordForEmail).
 *
 * Politique : 8 caractères min, 1 majuscule, 1 chiffre.
 */

const PWD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function validate(): string | null {
    if (!PWD_REGEX.test(password)) return "Minimum 8 caractères, 1 majuscule, 1 chiffre."
    if (password !== confirm) return "Les mots de passe ne correspondent pas."
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); return }

    setLoading(true)
    setError(null)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password })
      if (upErr) throw upErr
      setSuccess(true)
      setTimeout(() => router.push("/dashboard"), 1500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060B14] px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
          {success ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-400" size={36} />
              <h2 className="text-white font-bold">Mot de passe mis à jour</h2>
              <p className="text-sm text-gray-400">Redirection en cours…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white mb-1">Nouveau mot de passe</h1>
                <p className="text-sm text-gray-400">
                  Choisissez un mot de passe sécurisé.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                  Confirmation
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <p className="text-[11px] text-gray-600">
                Minimum 8 caractères, 1 majuscule, 1 chiffre.
              </p>

              {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>Mettre à jour <ArrowRight size={15} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
