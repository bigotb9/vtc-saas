"use client"

import { useState } from "react"
import { Search, ChevronDown, BookOpen, Wallet, Car, Users, Shield, Sparkles, MessageCircle } from "lucide-react"

/**
 * Centre d'aide / FAQ. Catégorisé pour faciliter la recherche.
 * Liens vidéos tutoriels à brancher quand on en aura.
 */

type Faq = { q: string; a: string }
type Category = { id: string; label: string; icon: React.ElementType; faqs: Faq[] }

const CATEGORIES: Category[] = [
  {
    id: "getting-started",
    label: "Démarrage",
    icon: BookOpen,
    faqs: [
      { q: "Comment ajouter mon premier véhicule ?",
        a: "Allez dans le menu Véhicules → Nouveau véhicule. Renseignez la plaque, la marque, le modèle et les documents (carte grise, assurance). Vous pouvez ensuite affecter un chauffeur." },
      { q: "Comment inviter un membre de mon équipe ?",
        a: "Dans Mon compte → Équipe, cliquez sur Inviter. L'utilisateur recevra un email pour définir son mot de passe. Le quota dépend de votre plan (3 pour Silver, 8 pour Gold, illimité pour Platinum)." },
      { q: "Quelle est la différence entre les plans Silver, Gold et Platinum ?",
        a: "Silver : 15 véhicules, 3 utilisateurs, modules essentiels + Wave. Gold : 40 véhicules, 8 utilisateurs, ajoute Yango, gestion clients tiers et rapports PDF. Platinum : illimité avec AI Insights et Agent IA inclus." },
    ],
  },
  {
    id: "wave",
    label: "Recettes & Wave",
    icon: Wallet,
    faqs: [
      { q: "Comment importer mes recettes Wave ?",
        a: "Téléchargez votre relevé Wave en CSV depuis l'app Wave Business, puis dans Recettes → Importer. Le système attribue automatiquement les recettes aux jours d'exploitation." },
      { q: "Pourquoi une recette n'est pas attribuée à un véhicule ?",
        a: "L'attribution se fait par numéro de chauffeur. Vérifiez que tous vos chauffeurs ont leur numéro Wave renseigné dans leur profil." },
    ],
  },
  {
    id: "vehicles",
    label: "Véhicules & chauffeurs",
    icon: Car,
    faqs: [
      { q: "Comment activer une alerte de document expiré ?",
        a: "Renseignez les dates d'expiration (carte grise, assurance) sur la fiche véhicule. Les alertes apparaissent automatiquement sur le dashboard 30 jours avant expiration." },
      { q: "Comment gérer les véhicules d'un client tiers (Gold+) ?",
        a: "Dans Clients, créez le profil du propriétaire, puis associez les véhicules au client via la fiche véhicule. Les recettes et dépenses sont consolidées par client." },
    ],
  },
  {
    id: "team",
    label: "Équipe & permissions",
    icon: Users,
    faqs: [
      { q: "Quels sont les rôles disponibles ?",
        a: "Directeur (accès total), dispatcher (gestion opérationnelle), lecture seule (consultation). Le directeur peut configurer les permissions fines via Mon compte → Équipe." },
    ],
  },
  {
    id: "security",
    label: "Sécurité",
    icon: Shield,
    faqs: [
      { q: "Comment activer la 2FA ?",
        a: "Mon compte → Sécurité → Activer la 2FA. Scannez le QR code avec Google Authenticator (ou 1Password, Authy) puis confirmez avec le code à 6 chiffres." },
      { q: "Mes données sont-elles isolées des autres clients ?",
        a: "Oui, totalement. Chaque client dispose de son propre projet Supabase avec sa base de données dédiée. Aucune donnée n'est partagée entre clients." },
      { q: "J'ai oublié mon mot de passe, que faire ?",
        a: "Sur la page de connexion, cliquez sur \"Mot de passe oublié\". Vous recevrez un email avec un lien de réinitialisation." },
    ],
  },
  {
    id: "billing",
    label: "Facturation",
    icon: Sparkles,
    faqs: [
      { q: "Comment changer de plan ?",
        a: "Mon compte → Plan → choisissez votre nouveau plan. L'effet est immédiat ; le nouveau tarif s'applique au prochain cycle de facturation." },
      { q: "Comment annuler mon abonnement ?",
        a: "Mon compte → Plan → Annuler. Vous gardez l'accès jusqu'à la fin de la période payée. Vous pouvez réactiver à tout moment avant l'expiration." },
      { q: "Comment télécharger mes factures ?",
        a: "Mon compte → Facturation → bouton PDF sur la ligne de la facture concernée." },
    ],
  },
]


export default function HelpPage() {
  const [search, setSearch] = useState("")
  const [openCategory, setOpenCategory] = useState<string | null>("getting-started")

  const filtered = CATEGORIES.map(cat => ({
    ...cat,
    faqs: cat.faqs.filter(f => {
      if (!search.trim()) return true
      const s = search.toLowerCase()
      return f.q.toLowerCase().includes(s) || f.a.toLowerCase().includes(s)
    }),
  })).filter(cat => cat.faqs.length > 0)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Centre d&apos;aide</h1>
        <p className="text-gray-600 dark:text-gray-400">Trouvez vos réponses ou contactez notre équipe.</p>
      </div>

      {/* Recherche */}
      <div className="relative mb-8">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher dans la FAQ…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      {/* FAQ par catégorie */}
      <div className="space-y-3">
        {filtered.map((cat) => {
          const isOpen = openCategory === cat.id
          return (
            <div key={cat.id} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
              <button
                onClick={() => setOpenCategory(isOpen ? null : cat.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <cat.icon size={16} />
                </div>
                <span className="font-medium flex-1">{cat.label}</span>
                <span className="text-xs text-gray-400">{cat.faqs.length} article{cat.faqs.length > 1 ? "s" : ""}</span>
                <ChevronDown size={16} className={`text-gray-400 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 dark:border-white/5 px-5 py-2 space-y-3">
                  {cat.faqs.map((f, i) => (
                    <details key={i} className="group">
                      <summary className="cursor-pointer py-2 font-medium text-sm flex items-center gap-2">
                        <ChevronDown size={14} className="text-gray-400 transition group-open:rotate-180" />
                        {f.q}
                      </summary>
                      <div className="text-sm text-gray-600 dark:text-gray-400 pl-6 pb-2 leading-relaxed">{f.a}</div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Aucun résultat pour « {search} ».
          </div>
        )}
      </div>

      {/* CTA contact */}
      <div className="mt-10 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/5 p-6 text-center">
        <MessageCircle size={28} className="mx-auto text-indigo-600 dark:text-indigo-400 mb-3" />
        <h3 className="font-semibold mb-1">Vous ne trouvez pas votre réponse ?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Notre équipe répond sous 24h en jours ouvrés.</p>
        <a
          href="mailto:support@vtcdashboard.com"
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 text-sm"
        >
          Contacter le support
        </a>
      </div>
    </div>
  )
}
