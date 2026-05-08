"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, ArrowRight, CheckCircle2, Loader2, AlertCircle, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useTenant } from "@/components/TenantProvider"

/**
 * Page de bienvenue affichée au premier login (après clic sur le magic link
 * d'invitation). Force le client à définir son mot de passe avant
 * d'accéder au dashboard.
 *
 * Détection : on lit user.user_metadata.password_set. Si absent ou false,
 * on est en first-login → on demande le mot de passe.
 *
 * Flow :
 *   1. Le magic link Supabase a établi une session (access_token dans le fragment).
 *   2. Cette page lit la session, vérifie que le user n'a pas de password_set.
 *   3. Demande au user de saisir son mot de passe (+confirmation).
 *   4. updateUser({ password, data: { password_set: true } })
 *   5. Redirect vers /dashboard.
 *
 * Politique mot de passe : 8 caractères min, 1 majuscule, 1 chiffre.
 */

const PWD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/

export default function WelcomePage() {
  const router = useRouter()
  const { tenant } = useTenant()
  const [user, setUser]         = useState<{ email?: string } | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm]   = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  // Vérifie qu'on a une session valide ; sinon redirige vers /
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push("/")
        return
      }
      setUser(data.session.user)

      // Si le password est déjà défini, on saute cette page
      const alreadySet = data.session.user.user_metadata?.password_set === true
      if (alreadySet) {
        router.push("/dashboard")
        return
      }
      setChecking(false)
    })()
  }, [router])

  function validate(): string | null {
    if (!PWD_REGEX.test(password)) return "Minimum 8 caractères, 1 majuscule, 1 chiffre."
    if (password !== confirm) return "Les mots de passe ne correspondent pas."
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); return }

    setSubmitting(true)
    setError(null)
    try {
      const { error: upErr } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      })
      if (upErr) throw upErr
      setSuccess(true)
      // Si c'est un premier login lié à un plan nécessitant Yango/Wave,
      // rediriger vers la page d'intégrations en mode onboarding.
      // Autrement aller directement au dashboard.
      const slug = typeof document !== "undefined"
        ? document.cookie.match(/tenant_slug=([^;]+)/)?.[1] : null
      const dest = slug ? "/account/integrations?onboarding=1" : "/dashboard"
      setTimeout(() => router.push(dest), 1500)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-[#060B14]">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060B14] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
          {success ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-400" size={36} />
              <h2 className="text-white font-bold text-lg">Mot de passe créé</h2>
              <p className="text-sm text-gray-400">Bienvenue sur {tenant?.nom || "votre espace"} ! Redirection en cours…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/30 mb-3">
                  <Sparkles className="text-white" size={22} />
                </div>
                <h1 className="text-xl font-bold text-white">Bienvenue !</h1>
                <p className="text-sm text-gray-400 mt-1">
                  {tenant?.nom ? `Votre espace ${tenant.nom} est prêt.` : "Votre espace est prêt."}
                  <br />
                  Définissez votre mot de passe pour vous connecter.
                </p>
                {user?.email && (
                  <div className="mt-3 inline-flex items-center gap-2 text-xs text-gray-500 bg-white/[0.03] px-3 py-1.5 rounded-full">
                    Compte : <strong className="text-gray-300">{user.email}</strong>
                  </div>
                )}
              </div>

              <div className="pt-2">
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
                    autoFocus
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
                disabled={submitting || !password || !confirm}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <>Continuer <ArrowRight size={15} /></>}
              </button>

              <p className="text-[11px] text-center text-gray-600 pt-1">
                Vous pourrez vous reconnecter plus tard avec votre email et ce mot de passe.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
