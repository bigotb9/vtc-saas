import Link from "next/link"
import { CheckCircle2, AlertTriangle, Receipt, Calendar, Hash } from "lucide-react"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { formatFcfa } from "@/lib/plans"
import { getAvailableProviders } from "@/lib/payment"
import PayInvoiceChoice from "./PayInvoiceChoice"

/**
 * Page publique de paiement d'une facture (renewal). Accessible via le
 * lien envoyé par email à J-7 / J-3.
 *
 * Workflow :
 *   1. User clique le lien dans l'email
 *   2. Page affiche la facture + boutons Wave/Stripe
 *   3. Clic → /api/payment/create-checkout avec invoice_id
 *   4. Redirect vers checkout
 *   5. Webhook → handleRenewalPayment → facture marquée payée + sub renouvelée
 */

type Props = {
  params: Promise<{ id: string }>
}

export default async function PayInvoicePage({ params }: Props) {
  const { id } = await params

  const { data: invoice } = await supabaseMaster
    .from("invoices")
    .select(`
      id, invoice_number, amount_fcfa, currency, status, line_items,
      issued_at, due_at, paid_at,
      tenant:tenants ( id, nom, email_admin )
    `)
    .eq("id", id)
    .maybeSingle()

  if (!invoice) {
    return (
      <PageWrap>
        <h1 className="text-2xl font-bold mb-2">Facture introuvable</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Le lien semble incorrect ou la facture a été supprimée.</p>
        <Link href="/landing" className="text-indigo-600 hover:underline">Retour à l&apos;accueil</Link>
      </PageWrap>
    )
  }

  const tenant = invoice.tenant as unknown as { id: string; nom: string; email_admin: string }

  if (invoice.status === "paid") {
    return (
      <PageWrap>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 mb-4">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={26} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Facture déjà payée</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          La facture <strong>{invoice.invoice_number}</strong> a été réglée le {formatDate(invoice.paid_at!)}.
        </p>
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline text-sm"
        >
          Télécharger la facture
        </a>
      </PageWrap>
    )
  }

  if (invoice.status === "void" || invoice.status === "uncollectible") {
    return (
      <PageWrap>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/20 mb-4">
          <AlertTriangle className="text-red-600 dark:text-red-400" size={26} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Facture annulée</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Cette facture n&apos;est plus à payer. Contactez-nous si nécessaire :
          <a href="mailto:support@vtcdashboard.com" className="text-indigo-600 hover:underline ml-1">support@vtcdashboard.com</a>
        </p>
      </PageWrap>
    )
  }

  const lines = (invoice.line_items as { label: string; amount_fcfa: number }[]) || []
  const providers = getAvailableProviders()

  return (
    <PageWrap>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 mb-3">
          <Receipt className="text-indigo-600 dark:text-indigo-400" size={22} />
        </div>
        <h1 className="text-2xl font-bold mb-1">Régler votre facture</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Bonjour {tenant.nom}, voici le détail de votre facture.
        </p>
      </div>

      {/* Récap facture */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Facture</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-medium uppercase">
            À payer
          </span>
        </div>
        <dl className="space-y-2 text-sm">
          <Row icon={Hash}     label="Numéro"   value={invoice.invoice_number} />
          <Row icon={Calendar} label="Émise le" value={formatDate(invoice.issued_at)} />
          <Row icon={Calendar} label="Échéance" value={formatDate(invoice.due_at)} />
        </dl>
        <div className="border-t border-gray-200 dark:border-white/10 mt-3 pt-3 space-y-1.5 text-sm">
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{l.label}</span>
              <span className="font-medium">{formatFcfa(l.amount_fcfa)}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 dark:border-white/10 mt-2 pt-2 flex justify-between font-bold text-lg">
            <span>Total à payer</span>
            <span>{formatFcfa(invoice.amount_fcfa)}</span>
          </div>
        </div>
      </div>

      <PayInvoiceChoice tenantId={tenant.id} invoiceId={invoice.id} providers={providers} />

      <div className="text-center mt-6">
        <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400">
          Télécharger la facture (PDF)
        </a>
      </div>
    </PageWrap>
  )
}


function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080C14] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg text-center">{children}</div>
    </div>
  )
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-left">
      <span className="text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
        <Icon size={12} />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}
