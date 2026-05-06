import Link from "next/link"
import { Clock, ShieldCheck, Sparkles } from "lucide-react"
import { supabaseMaster } from "@/lib/supabaseMaster"
import {
  ADDONS, getSignupTotalFcfa, PLANS, formatFcfa,
  type AddonId, type PlanId,
} from "@/lib/plans"
import { getAvailableProviders } from "@/lib/payment"
import PaymentChoice from "./PaymentChoice"
import ProvisioningPoller from "./ProvisioningPoller"

/**
 * Page intermédiaire après inscription, en attendant que le paiement soit
 * intégré (Phase 2 — Wave + Stripe).
 *
 * Affiche :
 *   - le récap du signup (entreprise, plan choisi, montant)
 *   - un message expliquant la suite
 *   - le statut courant (awaiting_payment / creating / ready)
 *
 * Quand Phase 2 sera là, on remplace cette page par le checkout direct.
 */

type Props = {
  searchParams: Promise<{ id?: string }>
}

export default async function PaymentPage({ searchParams }: Props) {
  const sp = await searchParams
  const id = sp.id

  if (!id) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Lien invalide</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Aucun identifiant d&apos;inscription fourni.
        </p>
        <Link href="/signup" className="text-indigo-600 hover:underline">Retour à l&apos;inscription</Link>
      </div>
    )
  }

  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("id, slug, nom, email_admin, signup_plan_id, signup_billing_cycle, signup_data, provisioning_status, signup_completed_at")
    .eq("id", id)
    .maybeSingle()

  if (!tenant) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Inscription introuvable</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Cette inscription n&apos;existe plus ou a expiré.
        </p>
        <Link href="/signup" className="text-indigo-600 hover:underline">Recommencer</Link>
      </div>
    )
  }

  // Si le paiement a déjà été confirmé, on poll le status de provisioning
  if (tenant.provisioning_status !== "awaiting_payment") {
    return <ProvisioningPoller tenantId={tenant.id} slug={tenant.slug} initialStatus={tenant.provisioning_status} />
  }

  const plan = PLANS[tenant.signup_plan_id as PlanId]
  const cycle = tenant.signup_billing_cycle as "monthly" | "yearly"
  const signupData = (tenant.signup_data as Record<string, unknown> | null) ?? {}
  const addonIds = ((signupData.addons as string[] | undefined) ?? []).filter(
    (id): id is AddonId => !!ADDONS[id as AddonId],
  )
  const selectedAddons = addonIds.map(id => ADDONS[id])
  const totals = getSignupTotalFcfa(plan.id, cycle, addonIds)
  const totalAmount = totals.cycleTotal
  const availableProviders = getAvailableProviders()

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 mb-4">
          <Clock className="text-amber-600 dark:text-amber-400" size={22} />
        </div>
        <h1 className="text-3xl font-bold mb-3">Inscription enregistrée</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Bienvenue {tenant.nom}. Procédez au paiement pour activer votre espace.
        </p>
      </div>

      {/* Récap */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6 mb-6">
        <h2 className="font-semibold mb-4">Récapitulatif</h2>
        <dl className="space-y-3 text-sm">
          <Row label="Entreprise"   value={tenant.nom} />
          <Row label="Email admin"  value={tenant.email_admin} />
          <Row label="Plan choisi"  value={plan.name} />
          <Row label="Cycle"        value={cycle === "yearly" ? "Annuel (-15%)" : "Mensuel"} />

          {/* Détail tarifaire */}
          <div className="border-t border-gray-200 dark:border-white/10 pt-3 space-y-2">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Plan {plan.name}</span>
              <span>{formatFcfa(plan.priceMonthlyFcfa)} / mois</span>
            </div>
            {selectedAddons.map(a => (
              <div key={a.id} className="flex justify-between text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles size={12} className="text-indigo-500" />
                  {a.name}
                </span>
                <span>+ {formatFcfa(a.priceMonthlyFcfa!)} / mois</span>
              </div>
            ))}
            <div className="border-t border-gray-200 dark:border-white/10 pt-2 flex justify-between font-semibold">
              <span>Total mensuel</span>
              <span>{formatFcfa(totals.monthlyTotal)}</span>
            </div>
            {cycle === "yearly" && (
              <div className="flex justify-between text-amber-700 dark:text-amber-400 text-xs">
                <span>Annuel (avec -15%) — vous payez maintenant</span>
                <span className="font-bold">{formatFcfa(totalAmount)}</span>
              </div>
            )}
          </div>
        </dl>
      </div>

      {/* Choix du moyen de paiement */}
      <PaymentChoice tenantId={tenant.id} providers={availableProviders} />

      <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <ShieldCheck size={14} className="shrink-0 mt-0.5" />
        <span>
          Vos données sont sécurisées. Aucun débit ne sera effectué tant que vous n&apos;avez pas confirmé le paiement.
        </span>
      </div>

      <div className="mt-8 text-center">
        <Link href="/landing" className="text-sm text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400">
          ← Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  )
}


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}


