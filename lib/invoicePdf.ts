import "server-only"
import { jsPDF } from "jspdf"
import { formatFcfa } from "./plans"

/**
 * Génère un PDF de facture à partir des données issues du master.
 *
 * Implémentation minimale (peut être enrichie : logo, signature, conditions
 * de paiement détaillées, mentions légales CI). Utilise jsPDF déjà en deps.
 */

export type InvoicePdfData = {
  invoiceNumber:   string
  issuedAt:        string         // ISO
  dueAt:           string
  paidAt?:         string | null

  status:          "draft" | "open" | "paid" | "uncollectible" | "void"

  // Vendeur (VTC Dashboard)
  seller: {
    name:    string               // "VTC Dashboard"
    email:   string
    address?: string
  }

  // Client
  customer: {
    name:    string
    email:   string
    phone?:  string
    country?: string
  }

  // Lignes
  lines: { label: string; amount_fcfa: number }[]

  totalFcfa:       number
  currency:        string
}

/**
 * Génère le PDF et retourne l'ArrayBuffer (compatible NextResponse / Blob).
 */
export function generateInvoicePdf(data: InvoicePdfData): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })

  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // ─── Header ───
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.text("VTC DASHBOARD", margin, y + 6)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text("Plateforme de gestion VTC", margin, y + 12)

  doc.setFontSize(22)
  doc.setTextColor(40, 40, 40)
  doc.setFont("helvetica", "bold")
  doc.text("FACTURE", pageW - margin, y + 6, { align: "right" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`N° ${data.invoiceNumber}`, pageW - margin, y + 12, { align: "right" })

  // Status badge
  y += 18
  const badgeColor =
    data.status === "paid"          ? [22, 163, 74]   // emerald
    : data.status === "open"        ? [234, 179, 8]   // amber
    : data.status === "uncollectible" ? [220, 38, 38] // red
    : [156, 163, 175]                                  // gray

  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2])
  doc.roundedRect(pageW - margin - 30, y - 5, 30, 7, 2, 2, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text(data.status.toUpperCase(), pageW - margin - 15, y, { align: "center" })

  // ─── Infos vendeur / client ───
  y += 12
  doc.setTextColor(60, 60, 60)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("ÉMETTEUR", margin, y)
  doc.text("CLIENT", pageW / 2 + 5, y)

  y += 5
  doc.setFont("helvetica", "normal")
  doc.setTextColor(40, 40, 40)
  doc.setFontSize(10)
  doc.text(data.seller.name, margin, y)
  doc.text(data.customer.name, pageW / 2 + 5, y)

  y += 5
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  doc.text(data.seller.email, margin, y)
  doc.text(data.customer.email, pageW / 2 + 5, y)

  if (data.seller.address) {
    y += 4
    doc.text(data.seller.address, margin, y)
  }
  if (data.customer.phone) {
    const yPhone = data.seller.address ? y : y + 4
    doc.text(data.customer.phone, pageW / 2 + 5, yPhone)
    if (!data.seller.address) y = yPhone
  }

  // ─── Dates ───
  y += 12
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(`Date d'émission : ${formatDate(data.issuedAt)}`, margin, y)
  doc.text(`Échéance : ${formatDate(data.dueAt)}`, pageW / 2 + 5, y)
  if (data.paidAt) {
    y += 5
    doc.setTextColor(22, 163, 74)
    doc.text(`Payée le ${formatDate(data.paidAt)}`, margin, y)
  }

  // ─── Tableau des lignes ───
  y += 10
  doc.setFillColor(243, 244, 246)
  doc.rect(margin, y, pageW - margin * 2, 8, "F")
  doc.setFont("helvetica", "bold")
  doc.setTextColor(60, 60, 60)
  doc.setFontSize(9)
  doc.text("DESCRIPTION", margin + 2, y + 5.5)
  doc.text("MONTANT", pageW - margin - 2, y + 5.5, { align: "right" })

  y += 8
  doc.setFont("helvetica", "normal")
  doc.setTextColor(40, 40, 40)
  doc.setFontSize(10)

  for (const line of data.lines) {
    doc.text(line.label, margin + 2, y + 6)
    doc.text(formatFcfa(line.amount_fcfa), pageW - margin - 2, y + 6, { align: "right" })
    doc.setDrawColor(229, 231, 235)
    doc.line(margin, y + 9, pageW - margin, y + 9)
    y += 9
  }

  // ─── Total ───
  y += 4
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("TOTAL", pageW - margin - 60, y + 6)
  doc.text(formatFcfa(data.totalFcfa), pageW - margin - 2, y + 6, { align: "right" })

  // ─── Footer ───
  const footerY = doc.internal.pageSize.getHeight() - 25
  doc.setDrawColor(229, 231, 235)
  doc.line(margin, footerY, pageW - margin, footerY)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text("VTC Dashboard — Plateforme de gestion de véhicules de transport", margin, footerY + 6)
  doc.text(data.seller.email, margin, footerY + 11)
  doc.text(`Page 1 / 1`, pageW - margin, footerY + 6, { align: "right" })

  return doc.output("arraybuffer") as ArrayBuffer
}


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day:   "2-digit",
    month: "long",
    year:  "numeric",
  })
}
