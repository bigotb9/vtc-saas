"use client"

import { useEffect, useState } from "react"
import { Loader2, Download, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { formatFcfa } from "@/lib/plans"

type Invoice = {
  id:             string
  invoice_number: string
  amount_fcfa:    number
  currency:       string
  status:         "draft" | "open" | "paid" | "uncollectible" | "void"
  issued_at:      string
  due_at:         string
  paid_at:        string | null
  line_items:     { label: string; amount_fcfa: number }[]
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    authFetch("/api/account/invoices")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json() as Promise<{ invoices: Invoice[] }>
      })
      .then((d) => setInvoices(d.invoices))
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }
  if (!invoices) return <Loader2 className="animate-spin text-indigo-500" />

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Aucune facture pour le moment.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03] text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">N° Facture</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium">Montant</th>
              <th className="text-center px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-gray-100 dark:border-white/5">
                <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(inv.issued_at)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {inv.line_items[0]?.label ?? "Abonnement"}
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatFcfa(inv.amount_fcfa)}</td>
                <td className="px-4 py-3 text-center"><InvoiceBadge status={inv.status} /></td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/api/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                  >
                    <Download size={14} />
                    PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function InvoiceBadge({ status }: { status: Invoice["status"] }) {
  switch (status) {
    case "paid":
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"><CheckCircle2 size={12} /> Payée</span>
    case "open":
      return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">À payer</span>
    case "uncollectible":
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"><XCircle size={12} /> Échec</span>
    default:
      return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">{status}</span>
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}
