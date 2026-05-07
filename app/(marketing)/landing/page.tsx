import Link from "next/link"
import {
  ArrowRight,
  Car,
  CreditCard,
  Sparkles,
  ShieldCheck,
  Wallet,
  Users,
  Bell,
  FileText,
  CheckCircle2,
} from "lucide-react"
import AgentSection from "./AgentSection"

/**
 * Landing publique vtcdashboard.com.
 * Servi à la racine `/` quand pas de tenant résolu (cf. proxy.ts).
 */

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Features />
      <AgentSection />
      <PricingTeaser />
      <FinalCta />
    </>
  )
}


// ────────── Hero ──────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-amber-50 dark:from-indigo-950/40 dark:via-[#0A0F1A] dark:to-amber-950/30" />
      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 dark:bg-indigo-500/20 px-4 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-6">
          <Sparkles size={14} />
          Plateforme de gestion de véhicules de transport
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
          Pilotez votre flotte VTC
          <br />
          <span className="bg-gradient-to-r from-indigo-600 to-amber-500 bg-clip-text text-transparent">
            sans plus jamais sortir Excel.
          </span>
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10">
          Recettes Wave automatiques, suivi chauffeurs, alertes documents,
          partenariat Yango, rapports PDF. Conçu pour la Côte d&apos;Ivoire et
          l&apos;Afrique de l&apos;Ouest.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 transition shadow-lg shadow-indigo-600/20"
          >
            Commencer maintenant
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white font-medium px-6 py-3 transition"
          >
            Voir les tarifs
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Activation immédiate après paiement · Sans engagement
        </p>
      </div>
    </section>
  )
}


// ────────── Trust bar ──────────

function TrustBar() {
  const items = [
    { icon: ShieldCheck, label: "Données isolées par client" },
    { icon: CreditCard,  label: "Paiement Wave + Carte bancaire" },
    { icon: Sparkles,    label: "Activation immédiate" },
  ]
  return (
    <section className="border-y border-gray-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]">
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300">
            <it.icon size={16} className="text-indigo-600 dark:text-indigo-400" />
            {it.label}
          </div>
        ))}
      </div>
    </section>
  )
}


// ────────── Features ──────────

function Features() {
  const features = [
    { icon: Car,        title: "Gestion véhicules",   text: "Documents, entretiens, dépenses, fiches PDF par véhicule." },
    { icon: Users,      title: "Chauffeurs",          text: "Affectations, classement performance, journal d'activité." },
    { icon: Wallet,     title: "Recettes Wave",       text: "Import automatique, attribution intelligente par jour." },
    { icon: Bell,       title: "Alertes proactives",  text: "Documents expirés, paiements en retard, échéances." },
    { icon: FileText,   title: "Rapports PDF",        text: "Bilans mensuels, fiches véhicules, exports comptables." },
    { icon: Sparkles,   title: "AI Insights",         text: "Détection chauffeurs à risque + messages WhatsApp prêts." },
  ]
  return (
    <section id="features" className="py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Tout ce qu&apos;il faut pour gérer votre flotte
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Une plateforme unique pour remplacer cahiers, Excel et applications éparpillées.
          </p>
        </div>

        {/* Vidéo démo — lecture automatique en boucle silencieuse */}
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/5 shadow-xl mb-12">
          <video
            src="/demo.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full block"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] p-6 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 mb-4">
                <f.icon size={20} />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}


// ────────── Pricing teaser ──────────

function PricingTeaser() {
  const points = [
    "3 plans : Silver, Gold, Platinum",
    "Facturation mensuelle ou annuelle (-15%)",
    "Wave CI + Carte bancaire",
    "Pas de période d'essai — activation après paiement",
  ]
  return (
    <section className="py-16 bg-gray-50 dark:bg-white/[0.02] border-y border-gray-200/60 dark:border-white/5">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Une tarification simple</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
          Choisissez le plan adapté à la taille de votre flotte. Changez de plan à tout moment.
        </p>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto mb-8">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-left text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
              {p}
            </li>
          ))}
        </ul>

        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 transition"
        >
          Voir les 3 plans
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  )
}




// ────────── Final CTA ──────────

function FinalCta() {
  return (
    <section id="contact" className="py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="rounded-3xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-600 to-amber-500 p-10 md:p-14 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à reprendre le contrôle de votre flotte ?
          </h2>
          <p className="text-white/90 max-w-xl mx-auto mb-8">
            Rejoignez les flottes VTC qui simplifient leur gestion quotidienne avec VTC Dashboard.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-white text-indigo-700 hover:bg-indigo-50 font-medium px-6 py-3 transition shadow-xl"
          >
            Commencer maintenant
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}
