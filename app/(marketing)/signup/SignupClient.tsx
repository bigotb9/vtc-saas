"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowRight, Loader2, AlertCircle } from "lucide-react"
import {
  formatFcfa,
  type BillingCycle,
  type Plan,
  type PlanId,
} from "@/lib/plans"

type Props = {
  plans:        Plan[]
  defaultPlan:  PlanId
  defaultCycle: BillingCycle
}

export default function SignupClient({ plans, defaultPlan, defaultCycle }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [planId, setPlanId] = useState<PlanId>(defaultPlan)
  const [cycle, setCycle]   = useState<BillingCycle>(defaultCycle)
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [country, setCountry] = useState("CI")
  const [expectedVehicles, setExpectedVehicles] = useState<number | "">("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const selectedPlan = plans.find((p) => p.id === planId)!
  const monthlyDisplay =
    cycle === "monthly"
      ? selectedPlan.priceMonthlyFcfa
      : Math.round(selectedPlan.priceYearlyFcfa / 12)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!acceptedTerms) {
      setError("Vous devez accepter les conditions générales pour continuer.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name:      companyName,
          email,
          phone,
          country,
          expected_vehicles: expectedVehicles || null,
          plan_id:           planId,
          billing_cycle:     cycle,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Erreur HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      router.push(`/signup/payment?id=${json.signup_id}`)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Créer votre compte</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Quelques informations puis paiement — votre espace sera créé automatiquement.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Plan & cycle */}
        <Section title="1. Plan choisi">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                className={`text-left rounded-xl border p-4 transition ${
                  planId === p.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                    : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-gray-300"
                }`}
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatFcfa(p.priceMonthlyFcfa)} / mois
                </div>
              </button>
            ))}
          </div>

          <div className="inline-flex p-1 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04]">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`px-4 py-1.5 text-sm rounded-full transition ${
                cycle === "monthly" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-300"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={`px-4 py-1.5 text-sm rounded-full transition ${
                cycle === "yearly" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-300"
              }`}
            >
              Annuel <span className="text-amber-500">-15%</span>
            </button>
          </div>

          <div className="mt-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">À payer : </span>
            <span className="font-bold">{formatFcfa(monthlyDisplay)}</span>
            <span className="text-gray-500 dark:text-gray-400"> / mois</span>
            {cycle === "yearly" && (
              <span className="text-gray-500 dark:text-gray-400"> · facturé annuellement {formatFcfa(selectedPlan.priceYearlyFcfa)}</span>
            )}
          </div>
        </Section>

        {/* Entreprise & contact */}
        <Section title="2. Votre entreprise">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Nom de l'entreprise" required>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input"
                placeholder="VTC Boyah Group"
              />
            </Field>
            <Field label="Email administrateur" required>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="vous@entreprise.com"
              />
            </Field>
            <Field label="Téléphone" required>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="+225 07 00 00 00 00"
              />
            </Field>
            <Field label="Pays">
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="input">
                <option value="CI">Côte d&apos;Ivoire</option>
                <option value="SN">Sénégal</option>
                <option value="ML">Mali</option>
                <option value="BF">Burkina Faso</option>
                <option value="TG">Togo</option>
                <option value="BJ">Bénin</option>
                <option value="other">Autre</option>
              </select>
            </Field>
            <Field label="Nombre de véhicules estimé">
              <input
                type="number"
                min={1}
                value={expectedVehicles}
                onChange={(e) => setExpectedVehicles(e.target.value ? Number(e.target.value) : "")}
                className="input"
                placeholder="10"
              />
            </Field>
          </div>
        </Section>

        {/* CGU */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            J&apos;accepte les conditions générales d&apos;utilisation et la politique de confidentialité.
          </span>
        </label>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 transition shadow-lg shadow-indigo-600/20"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          {submitting ? "Création de votre compte…" : "Continuer vers le paiement"}
        </button>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid rgb(229 231 235);
          background: white;
          font-size: 0.875rem;
          color: rgb(17 24 39);
        }
        :global(.dark) .input {
          border-color: rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: white;
        }
        .input:focus {
          outline: 2px solid rgb(99 102 241);
          outline-offset: 1px;
        }
      `}</style>
    </div>
  )
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
      <h2 className="font-semibold mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}
