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
      <AiInsightsSection />
      <YangoSection />
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

        {/* Vidéo démo — lecture automatique en boucle, sans PiP ni contrôles */}
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/5 shadow-xl mb-12">
          <video
            src="/demo.mp4"
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            className="w-full block pointer-events-none"
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


// ────────── AI Insights ──────────

function AiInsightsSection() {
  const features = [
    {
      icon: "🎯",
      title: "Score chauffeurs en temps réel",
      text: "Chaque chauffeur reçoit un score composite (CA · régularité · tendance). Identifiez en un coup d'œil qui performe et qui décroche.",
      tag: "Analyse automatique",
    },
    {
      icon: "🔧",
      title: "Maintenance prédictive",
      text: "L'algorithme calcule la périodicité moyenne entre entretiens et prédit la prochaine intervention pour chaque véhicule, avant la panne.",
      tag: "Anticipation",
    },
    {
      icon: "📊",
      title: "Dépenses récurrentes & anomalies",
      text: "Détecte automatiquement les catégories de dépenses régulières et signale toute hausse suspecte supérieure à 50 % vs la période précédente.",
      tag: "Contrôle des coûts",
    },
    {
      icon: "💰",
      title: "Prévision trésorerie 7 jours",
      text: "Basée sur la moyenne des 30 derniers jours avec indice de confiance. Anticipez vos rentrées pour mieux gérer votre cashflow.",
      tag: "Prévisionnel",
    },
    {
      icon: "📱",
      title: "Messages WhatsApp pré-rédigés",
      text: "Pour chaque chauffeur à risque, l'IA génère un message de relance personnalisé prêt à envoyer — adapté à sa situation réelle.",
      tag: "Communication",
    },
    {
      icon: "📈",
      title: "Régularité & coefficient de variation",
      text: "Mesurez la stabilité de vos recettes quotidiennes. Un CV bas = flotte régulière. Un CV élevé = revenus erratiques à corriger.",
      tag: "Pilotage",
    },
  ]

  return (
    <section className="py-24 overflow-hidden" style={{
      background: "linear-gradient(180deg,#ffffff 0%,#f5f3ff 40%,#ede9fe 100%)"
    }}>
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-5"
              style={{ background: "rgba(139,92,246,.12)", color: "#7c3aed", border: "1px solid rgba(139,92,246,.25)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
              Option · +15 000 FCFA / mois · Inclus Platinum
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              AI Insights —<br />
              <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
                votre flotte analysée en continu
              </span>
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Un moteur d'analyse algorithmique 100 % automatique qui scrute vos données en temps réel
              et vous livre chaque jour une lecture claire de votre flotte — sans Claude, sans coût IA supplémentaire.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Silver · +15 000 F/mois", "Gold · +15 000 F/mois", "Platinum · inclus"].map(p => (
                <span key={p} className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(139,92,246,.1)", color: "#7c3aed", border: "1px solid rgba(139,92,246,.2)" }}>
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Maquette dashboard AI */}
          <div className="rounded-2xl border border-violet-200 overflow-hidden shadow-2xl shadow-violet-200/50">
            <div className="p-4" style={{ background: "linear-gradient(135deg,#1e1b4b,#2e1065)" }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🧠</span>
                <span className="text-white font-bold text-sm">AI Insights · Tableau de bord</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  ● Live
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: "CA 30 jours", value: "2 847 400 F", sub: "+14% ↑", color: "#22c55e" },
                  { label: "Jours sans recette", value: "3 / 30", sub: "Régularité 90%", color: "#f59e0b" },
                  { label: "Prévision 7j", value: "664 000 F", sub: "Confiance élevée", color: "#a78bfa" },
                  { label: "CV régularité", value: "22%", sub: "Flotte stable ✓", color: "#34d399" },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div className="text-xs text-white/40 mb-1">{k.label}</div>
                    <div className="font-bold text-white text-sm">{k.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: k.color }}>{k.sub}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)" }}>
                <div className="text-xs text-white/40 mb-2">Chauffeurs à surveiller</div>
                {[
                  { nom: "Konan Koffi", score: 41, status: "critical", label: "CA -38% · 3j inactif" },
                  { nom: "Yapi Adjobi", score: 67, status: "warn",     label: "Régularité 52%" },
                ].map(d => (
                  <div key={d.nom} className="flex items-center gap-2 mb-1.5 last:mb-0">
                    <span style={{ color: d.status === "critical" ? "#f87171" : "#fbbf24", fontSize: 12 }}>
                      {d.status === "critical" ? "🔴" : "🟡"}
                    </span>
                    <span className="text-white/80 text-xs font-medium">{d.nom}</span>
                    <span className="text-white/40 text-xs ml-auto">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grille features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="rounded-2xl p-5 transition hover:shadow-lg hover:shadow-violet-100"
              style={{ background: "#ffffff", border: "1px solid rgba(139,92,246,.15)" }}>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-0.5">{f.tag}</div>
                  <div className="font-semibold text-gray-900 text-sm">{f.title}</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}


// ────────── Partenariat Yango ──────────

function YangoSection() {
  const features = [
    {
      icon: "📊",
      title: "Dashboard courses en temps réel",
      text: "Suivez toutes les courses Yango de votre parc — CA généré, courses complétées, annulations, heures de pointe. Synchronisation automatique.",
      tag: "Pilotage",
    },
    {
      icon: "🏆",
      title: "Classement chauffeurs par performance",
      text: "Chaque chauffeur est classé par CA Yango, taux de complétion et régularité. Repérez vos top-performers et motivez les moins actifs.",
      tag: "Performance",
    },
    {
      icon: "🔄",
      title: "Synchronisation automatique des commandes",
      text: "Toutes les commandes Yango remontent dans votre base en temps réel. Historique complet, filtres par chauffeur, véhicule ou période.",
      tag: "Automatisation",
    },
    {
      icon: "💸",
      title: "Suivi des commissions opérateur",
      text: "Calculez automatiquement votre commission de 2,5 % sur chaque course et visualisez vos revenus Yango semaine par semaine.",
      tag: "Rentabilité",
    },
    {
      icon: "📱",
      title: "Messages WhatsApp de relance Yango",
      text: "L'IA génère des messages personnalisés pour les chauffeurs inactifs sur Yango — adaptés à leur historique de courses sur votre parc.",
      tag: "Communication",
    },
    {
      icon: "🚗",
      title: "Gestion flotte Yango depuis l'app",
      text: "Consultez vos prestataires et véhicules Yango directement depuis VTC Dashboard. Toutes vos données centralisées dans une seule interface.",
      tag: "Centralisation",
    },
  ]

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">

          {/* Maquette Yango */}
          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-2xl shadow-blue-100/50 order-last lg:order-first">
            <div className="p-4" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                  style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}>Y</div>
                <div>
                  <div className="text-white font-bold text-sm">Partenariat Yango</div>
                  <div className="text-xs text-white/40">Dernière synchro : il y a 3 min</div>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(34,197,94,.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,.25)" }}>
                  ● Connecté
                </span>
              </div>
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "CA semaine",      value: "494 100 F", color: "#fbbf24" },
                  { label: "Courses",          value: "312",       color: "#60a5fa" },
                  { label: "Commission op.",   value: "12 350 F",  color: "#34d399" },
                ].map(k => (
                  <div key={k.label} className="rounded-lg p-2.5 text-center"
                    style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)" }}>
                    <div className="font-bold text-sm" style={{ color: k.color }}>{k.value}</div>
                    <div className="text-[10px] text-white/35 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
              {/* Classement */}
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div className="text-xs text-white/35 mb-2 font-semibold uppercase tracking-wider">Top chauffeurs · semaine</div>
                {[
                  { pos: "🥇", nom: "Kouamé Assi",    ca: "127 500 F", courses: 68 },
                  { pos: "🥈", nom: "Yapi Adjobi",     ca: "115 800 F", courses: 61 },
                  { pos: "🥉", nom: "Traoré Moussa",   ca: "109 600 F", courses: 58 },
                ].map(d => (
                  <div key={d.nom} className="flex items-center gap-2 py-1.5"
                    style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <span className="text-base w-6">{d.pos}</span>
                    <span className="text-white/80 text-xs flex-1 font-medium">{d.nom}</span>
                    <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>{d.ca}</span>
                    <span className="text-white/30 text-[10px] w-14 text-right">{d.courses} courses</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-5"
              style={{ background: "rgba(245,158,11,.1)", color: "#b45309", border: "1px solid rgba(245,158,11,.25)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Inclus · Plans Gold & Platinum
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              Partenariat Yango —<br />
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                pilotez votre flotte partenaire
              </span>
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Connectez vos credentials Yango Business et synchronisez automatiquement toutes vos courses.
              Classement chauffeurs, suivi des commissions, alertes d'inactivité — tout en un seul endroit.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Gold · inclus", "Platinum · inclus"].map(p => (
                <span key={p} className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(245,158,11,.1)", color: "#b45309", border: "1px solid rgba(245,158,11,.2)" }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Grille features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="rounded-2xl p-5 transition hover:shadow-lg hover:shadow-amber-100"
              style={{ background: "#fffbf0", border: "1px solid rgba(245,158,11,.18)" }}>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">{f.tag}</div>
                  <div className="font-semibold text-gray-900 text-sm">{f.title}</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{f.text}</p>
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
