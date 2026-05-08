import "server-only"

/**
 * Export SYSCOHADA (plan comptable OHADA, Côte d'Ivoire).
 *
 * Génère un journal comptable CSV double-entrée à partir des recettes
 * (Wave) et dépenses du tenant. Format compatible avec la plupart des
 * logiciels comptables OHADA (SAGE, EBP, GFC).
 *
 * Comptes SYSCOHADA utilisés :
 *   - 706  Prestations de services (recettes VTC)
 *   - 4111 Clients (contre-partie recettes)
 *   - 571  Caisse ou 521 Banque (règlements)
 *   - 605  Achats non stockés (carburant, lubrifiant)
 *   - 613  Entretiens et réparations
 *   - 614  Primes d'assurance
 *   - 641  Impôts et taxes (vignette, patente)
 *   - 661  Charges de personnel (salaires chauffeurs)
 *   - 612  Locations et charges locatives
 *   - 631  Frais de transport
 *   - 618  Autres frais généraux
 *   - 4011 Fournisseurs (contre-partie dépenses)
 */

export type SyscohadaLine = {
  journal:  string   // VTE, ACH, BQ, OD
  date:     string   // YYYY-MM-DD
  compte:   string   // numéro de compte SYSCOHADA
  libelle:  string
  debit:    number
  credit:   number
  piece:    string   // numéro de pièce (R0001, D0001…)
}

// Mapping type de dépense → compte SYSCOHADA
const EXPENSE_ACCOUNT: Record<string, { compte: string; libelle: string }> = {
  carburant:   { compte: "605",  libelle: "Achats carburant/lubrifiant" },
  lubrifiant:  { compte: "605",  libelle: "Achats lubrifiant" },
  entretien:   { compte: "613",  libelle: "Entretiens et réparations" },
  reparation:  { compte: "613",  libelle: "Réparations véhicule" },
  assurance:   { compte: "614",  libelle: "Primes d'assurance" },
  vignette:    { compte: "6415", libelle: "Vignettes et taxes" },
  patente:     { compte: "6415", libelle: "Patente professionnelle" },
  impot:       { compte: "641",  libelle: "Impôts et taxes" },
  salaire:     { compte: "661",  libelle: "Rémunérations chauffeurs" },
  chauffeur:   { compte: "661",  libelle: "Charges de personnel" },
  location:    { compte: "612",  libelle: "Locations véhicules/locaux" },
  peage:       { compte: "631",  libelle: "Frais de transport" },
  lavage:      { compte: "613",  libelle: "Nettoyage véhicules" },
  amende:      { compte: "671",  libelle: "Amendes et pénalités" },
  parking:     { compte: "612",  libelle: "Frais de stationnement" },
}

function resolveExpenseAccount(type: string | null): { compte: string; libelle: string } {
  if (!type) return { compte: "618", libelle: "Autres frais généraux" }
  const key = type.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  for (const [k, v] of Object.entries(EXPENSE_ACCOUNT)) {
    if (key.includes(k)) return v
  }
  return { compte: "618", libelle: "Autres frais généraux" }
}

export function buildSyscohadaLines(data: {
  recettes: { date: string; chauffeur?: string; montant: number; piece: string }[]
  depenses: { date: string; type: string | null; description?: string; montant: number; piece: string }[]
}): SyscohadaLine[] {
  const lines: SyscohadaLine[] = []

  // Recettes : Débit 4111 (client) / Crédit 706 (prestations de services)
  for (const r of data.recettes) {
    if (!r.montant || r.montant <= 0) continue
    const lib = `Prestation VTC${r.chauffeur ? ` — ${r.chauffeur}` : ""}`
    lines.push({
      journal: "VTE",
      date:    r.date,
      compte:  "4111",
      libelle: lib,
      debit:   Math.round(r.montant),
      credit:  0,
      piece:   r.piece,
    })
    lines.push({
      journal: "VTE",
      date:    r.date,
      compte:  "706",
      libelle: lib,
      debit:   0,
      credit:  Math.round(r.montant),
      piece:   r.piece,
    })
  }

  // Dépenses : Débit compte charge / Crédit 4011 (fournisseur)
  for (const d of data.depenses) {
    if (!d.montant || d.montant <= 0) continue
    const acc = resolveExpenseAccount(d.type)
    const lib = d.description || acc.libelle
    lines.push({
      journal: "ACH",
      date:    d.date,
      compte:  acc.compte,
      libelle: lib,
      debit:   Math.round(d.montant),
      credit:  0,
      piece:   d.piece,
    })
    lines.push({
      journal: "ACH",
      date:    d.date,
      compte:  "4011",
      libelle: lib,
      debit:   0,
      credit:  Math.round(d.montant),
      piece:   d.piece,
    })
  }

  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.journal.localeCompare(b.journal))
}

export function exportSyscohadaCsv(
  lines:    SyscohadaLine[],
  nom:      string,
  period:   { from: string; to: string },
  lang:     "fr" | "en" = "fr",
): string {
  const labels = lang === "en"
    ? { journal: "Journal", date: "Date", compte: "Account", libelle: "Label", debit: "Debit", credit: "Credit", piece: "Ref" }
    : { journal: "Journal", date: "Date", compte: "N° Compte", libelle: "Libellé", debit: "Débit", credit: "Crédit", piece: "Pièce" }

  const fromStr = new Date(period.from).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")
  const toStr   = new Date(period.to).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")

  const meta = [
    lang === "en" ? `Company: ${nom}` : `Raison sociale: ${nom}`,
    lang === "en" ? `Period: ${fromStr} - ${toStr}` : `Période: ${fromStr} - ${toStr}`,
    lang === "en" ? "Accounting standard: SYSCOHADA" : "Référentiel: SYSCOHADA",
    "",
  ].join("\n")

  const header = Object.values(labels).join(";")

  const rows = lines.map(l => [
    l.journal,
    new Date(l.date).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR"),
    l.compte,
    `"${l.libelle.replace(/"/g, '""')}"`,
    l.debit  > 0 ? l.debit.toString()  : "",
    l.credit > 0 ? l.credit.toString() : "",
    l.piece,
  ].join(";"))

  const totalDebit  = lines.reduce((s, l) => s + l.debit,  0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const totals = lang === "en"
    ? `TOTAL;;;;"${totalDebit}";"${totalCredit}";`
    : `TOTAL;;;;"${totalDebit}";"${totalCredit}";`

  return [meta, header, ...rows, "", totals].join("\n")
}

// ── Summary stats for admin display ──
export type SyscohadaSummary = {
  total_recettes:  number
  total_depenses:  number
  net:             number
  lines_count:     number
  by_account:      { compte: string; libelle: string; debit: number; credit: number }[]
}

export function computeSyscohadaSummary(lines: SyscohadaLine[]): SyscohadaSummary {
  const total_recettes = lines
    .filter(l => l.compte === "706")
    .reduce((s, l) => s + l.credit, 0)

  const total_depenses = lines
    .filter(l => !["4011", "4111", "706"].includes(l.compte))
    .reduce((s, l) => s + l.debit, 0)

  const byAccount = new Map<string, { compte: string; libelle: string; debit: number; credit: number }>()
  for (const l of lines) {
    const key = l.compte
    const acc = byAccount.get(key) ?? { compte: l.compte, libelle: l.libelle, debit: 0, credit: 0 }
    acc.debit  += l.debit
    acc.credit += l.credit
    byAccount.set(key, acc)
  }

  return {
    total_recettes,
    total_depenses,
    net:         total_recettes - total_depenses,
    lines_count: lines.length,
    by_account:  [...byAccount.values()].sort((a, b) => a.compte.localeCompare(b.compte)),
  }
}
