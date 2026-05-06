"use client"

import { useEffect, useState } from "react"
import { Loader2, ShieldCheck, Smartphone, AlertTriangle, CheckCircle2, X } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

/**
 * Page de gestion du 2FA TOTP. Utilise le système MFA natif de Supabase Auth.
 *
 * Workflow d'enroll :
 *   1. mfa.enroll({factorType: 'totp'}) → renvoie qr_code + secret
 *   2. User scan le QR avec Google Authenticator / 1Password / etc.
 *   3. User saisit le code à 6 chiffres
 *   4. mfa.challenge() + mfa.verify() → factor activé
 *
 * Workflow de désactivation :
 *   1. mfa.unenroll(factorId)
 *
 * Le challenge à la connexion est géré dans app/page.tsx (login).
 */

type Factor = {
  id:           string
  factor_type:  string
  status:       "verified" | "unverified"
  friendly_name?: string
}

type EnrollData = {
  id:        string
  type:      string
  totp:      { qr_code: string; uri: string; secret: string }
}

export default function SecurityPage() {
  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState<EnrollData | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [code, setCode] = useState("")
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const totps = (data?.totp ?? []) as Factor[]
      setFactors(totps)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function startEnroll() {
    setError(null)
    setSuccess(null)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" })
      if (error) throw error
      setEnrolling(data as unknown as EnrollData)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function verifyEnroll() {
    if (!enrolling || !code.trim()) return
    setVerifying(true)
    setError(null)
    try {
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.id })
      if (chalErr) throw chalErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId:    enrolling.id,
        challengeId: chal!.id,
        code:        code.trim(),
      })
      if (verifyErr) throw verifyErr
      setSuccess("2FA activée avec succès. À la prochaine connexion, vous devrez entrer un code TOTP.")
      setEnrolling(null)
      setCode("")
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setVerifying(false)
    }
  }

  async function disableFactor(factorId: string) {
    setError(null)
    setSuccess(null)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      setSuccess("2FA désactivée.")
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (factors === null) return <Loader2 className="animate-spin text-indigo-500" />

  const activeFactor = factors.find(f => f.status === "verified") || null

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-indigo-100 dark:bg-indigo-500/20 p-3 shrink-0">
            <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={22} />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg mb-1">Authentification à deux facteurs</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Protégez votre compte avec une seconde étape lors de la connexion.
              Compatible avec Google Authenticator, 1Password, Authy.
            </p>

            {success && (
              <div className="mb-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 p-3 flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeFactor && !enrolling && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/10 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="font-medium">2FA activée (TOTP)</span>
                </div>
                <button
                  onClick={() => disableFactor(activeFactor.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Désactiver
                </button>
              </div>
            )}

            {!activeFactor && !enrolling && (
              <button
                onClick={startEnroll}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 text-sm"
              >
                <Smartphone size={14} />
                Activer la 2FA
              </button>
            )}

            {enrolling && (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-white/[0.02]">
                  <p className="text-sm font-medium mb-2">1. Scannez ce QR code</p>
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={enrolling.totp.qr_code} alt="QR code TOTP" className="w-40 h-40 rounded bg-white p-2" />
                    <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                      <p className="mb-2">Si le scan ne fonctionne pas, saisissez manuellement :</p>
                      <code className="block break-all bg-gray-100 dark:bg-white/5 p-2 rounded text-[10px]">
                        {enrolling.totp.secret}
                      </code>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">2. Saisissez le code à 6 chiffres</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="flex-1 max-w-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.05] px-3 py-2 text-lg tracking-widest font-mono"
                    />
                    <button
                      onClick={verifyEnroll}
                      disabled={verifying || code.length !== 6}
                      className="rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-4 py-2 text-sm inline-flex items-center gap-2"
                    >
                      {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Vérifier
                    </button>
                    <button
                      onClick={() => { setEnrolling(null); setCode("") }}
                      className="rounded-full border border-gray-200 dark:border-white/10 px-3 py-2 text-sm"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Politique mot de passe info */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
        <h2 className="font-semibold mb-2">Mot de passe</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Politique : minimum 8 caractères, 1 majuscule, 1 chiffre.
        </p>
        <a
          href="/forgot-password"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Réinitialiser mon mot de passe
        </a>
      </div>
    </div>
  )
}
