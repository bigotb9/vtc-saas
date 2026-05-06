"use client"

import { useState } from "react"
import Link from "next/link"
import { MessageCircle, X, Mail, BookOpen, Send, ChevronRight } from "lucide-react"
import { useTenant } from "./TenantProvider"

/**
 * Widget de support flottant en bas à droite. Mode actuel = panel statique
 * avec liens (email, WhatsApp, FAQ). Sera remplacé par un vrai chat live
 * (Crisp/Intercom) plus tard, via le slot CHAT_SCRIPT.
 *
 * Le widget est masqué sur les pages publiques (rendered uniquement quand
 * un tenant est résolu — i.e. côté app).
 */

const SUPPORT_EMAIL = "support@vtcdashboard.com"
const WHATSAPP_NUMBER = "+22500000000"  // À remplacer par le vrai numéro

export default function SupportWidget() {
  const { tenant } = useTenant()
  const [open, setOpen] = useState(false)

  if (!tenant) return null

  const emailSubject = encodeURIComponent(`[${tenant.slug}] Demande d'aide`)
  const emailBody = encodeURIComponent(`\n\n— Envoyé depuis VTC Dashboard\nClient : ${tenant.nom}\nSlug : ${tenant.slug}`)
  const whatsappMsg = encodeURIComponent(`Bonjour, je suis ${tenant.nom} (espace ${tenant.slug}). J'ai besoin d'aide :`)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-6 z-40 inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/30 transition"
        aria-label="Ouvrir le support"
      >
        <MessageCircle size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 md:p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-5 flex items-start justify-between">
              <div>
                <h3 className="font-bold">Besoin d&apos;aide ?</h3>
                <p className="text-sm text-white/80 mt-1">Notre équipe répond sous 24h en jours ouvrés.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Options */}
            <div className="p-2">
              <SupportOption
                icon={Mail}
                title="Envoyer un email"
                sub={SUPPORT_EMAIL}
                href={`mailto:${SUPPORT_EMAIL}?subject=${emailSubject}&body=${emailBody}`}
              />
              <SupportOption
                icon={Send}
                title="Discuter sur WhatsApp"
                sub="Réponse rapide en heures ouvrées"
                href={`https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${whatsappMsg}`}
              />
              <SupportOption
                icon={BookOpen}
                title="Centre d'aide & FAQ"
                sub="Articles et tutoriels"
                href="/help"
                internal
              />
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-white/5 text-center text-[11px] text-gray-500 dark:text-gray-400">
              Réponse prioritaire pour les clients Platinum
            </div>
          </div>
        </div>
      )}
    </>
  )
}


function SupportOption({ icon: Icon, title, sub, href, internal }: {
  icon: React.ElementType
  title: string
  sub: string
  href: string
  internal?: boolean
}) {
  const className = "flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition"
  const inner = (
    <>
      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{sub}</div>
      </div>
      <ChevronRight size={16} className="text-gray-400 shrink-0" />
    </>
  )
  if (internal) {
    return <Link href={href} className={className}>{inner}</Link>
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
  )
}
