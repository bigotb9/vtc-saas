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


// ────────── Agent IA ──────────

const CHAT_MESSAGES = [
  {
    role: "user",
    text: "Donne-moi la liste de mes véhicules avec les chauffeurs assignés",
    time: "08:14",
  },
  {
    role: "bot",
    text: "Voici votre flotte active 🚗\n\n1. Toyota Corolla · AB-1234-CI\n   👤 Kouamé Assi — En service ✅\n\n2. Hyundai i20 · AC-5678-CI\n   👤 Bamba Ouattara — En service ✅\n\n3. Kia Picanto · BD-9012-CI\n   👤 Konan Koffi — Maintenance ⚠️\n\n4. Toyota Yaris · AB-3456-CI\n   👤 Yapi Adjobi — En service ✅\n\n5. Hyundai Accent · CD-7890-CI\n   👤 Traoré Moussa — En service ✅\n\n→ 5 véhicules · 4 actifs aujourd'hui",
    time: "08:14",
  },
  {
    role: "user",
    text: "Fais-moi le point des recettes de cette semaine",
    time: "08:16",
  },
  {
    role: "bot",
    text: "📊 Recettes — Semaine du 28 avr au 4 mai\n\nKouamé Assi ........... 127 500 FCFA\nBamba Ouattara ....... 98 000 FCFA\nKonan Koffi .............. 43 200 FCFA\nYapi Adjobi .............. 115 800 FCFA\nTraoré Moussa ......... 109 600 FCFA\n\n💰 Total : 494 100 FCFA\n📈 +12 % vs semaine précédente\n\n💡 Konan Koffi a roulé 3 jours seulement — vérifiez la maintenance de son véhicule pour reprendre pleinement en semaine 19.",
    time: "08:16",
  },
  {
    role: "user",
    text: "Qui sont mes 2 meilleurs chauffeurs ce mois ?",
    time: "08:19",
  },
  {
    role: "bot",
    text: "🏆 Top 2 ce mois — Mai 2026\n\n🥇 Kouamé Assi\n   CA : 498 200 FCFA · 26 jours actifs\n   Régularité : 92 % ⭐\n\n🥈 Yapi Adjobi\n   CA : 461 000 FCFA · 25 jours actifs\n   Régularité : 88 %\n\n💡 Les deux chauffeurs maintiennent un CA 18 % au-dessus de la moyenne de la flotte. Envisagez un programme de fidélisation.",
    time: "08:19",
  },
  {
    role: "user",
    text: "Y a-t-il des alertes importantes aujourd'hui ?",
    time: "08:22",
  },
  {
    role: "bot",
    text: "🚨 3 alertes actives\n\n1. Assurance expirée dans 4 jours\n   → BD-9012-CI (Konan Koffi)\n\n2. Aucune recette Wave reçue aujourd'hui\n   → CD-7890-CI (Traoré Moussa)\n   Dernier mouvement : hier 19h42\n\n3. Versement client en retard\n   → Propriétaire Coulibaly · 75 000 FCFA\n   Dû depuis le 28 avril\n\nJe vous recommande de relancer Traoré Moussa et le propriétaire Coulibaly aujourd'hui.",
    time: "08:22",
  },
]

const BENEFITS = [
  {
    icon: "🔍",
    title: "Requêtes en langage naturel",
    text: "Posez n'importe quelle question en français. L'agent interroge votre base de données en temps réel et vous répond directement sur Telegram.",
  },
  {
    icon: "📊",
    title: "Rapports instantanés à la demande",
    text: "Recettes, dépenses, performance chauffeur, bilan mensuel — obtenez n'importe quel rapport en une phrase, sans ouvrir le dashboard.",
  },
  {
    icon: "🚨",
    title: "Détection proactive des anomalies",
    text: "L'agent surveille votre flotte en continu et vous alerte dès qu'une assurance expire, qu'un chauffeur est inactif ou qu'un paiement est en retard.",
  },
  {
    icon: "💡",
    title: "Recommandations orientées business",
    text: "Pas seulement des données — l'agent analyse les tendances et vous suggère des actions concrètes pour maximiser votre rentabilité.",
  },
  {
    icon: "🔒",
    title: "Agent dédié à votre flotte",
    text: "Votre agent accède uniquement à vos données, isolées dans votre propre base Supabase. Confidentialité totale, aucun partage.",
  },
]

function AgentSection() {
  const doubled = [...CHAT_MESSAGES, ...CHAT_MESSAGES]
  return (
    <section
      className="relative overflow-hidden py-24"
      style={{ background: "linear-gradient(180deg,#ffffff 0%,#020D1C 8%,#020D1C 92%,#ffffff 100%)" }}
    >
      {/* Glow ambiant */}
      <div className="pointer-events-none absolute inset-0">
        <div style={{
          position: "absolute", top: "30%", left: "55%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", top: "20%", left: "10%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(255,69,0,.1) 0%,transparent 70%)",
          filter: "blur(40px)",
        }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: 11, fontWeight: 700, letterSpacing: ".12em",
            textTransform: "uppercase",
            background: "rgba(99,102,241,.15)",
            border: "1px solid rgba(99,102,241,.35)",
            color: "#a5b4fc",
            padding: "5px 14px", borderRadius: 999,
            marginBottom: 18,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1" }} />
            Disponible en option sur Platinum
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Intègre un agent IA personnalisé<br />
            <span style={{
              background: "linear-gradient(135deg,#6366f1,#a855f7,#ec4899)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              à ton business
            </span>
          </h2>
          <p style={{ color: "rgba(255,255,255,.56)", maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            Un assistant IA branché sur votre base de données qui répond à toutes vos
            questions sur Telegram — en temps réel, en français, 24h/24.
          </p>
        </div>

        {/* Grid : bénéfices + téléphone */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* ── Bénéfices ── */}
          <div className="space-y-5">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                style={{
                  display: "flex", gap: 16, alignItems: "flex-start",
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 16, padding: "18px 20px",
                }}
              >
                <span style={{
                  fontSize: 22, flexShrink: 0,
                  width: 44, height: 44,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(99,102,241,.15)",
                  borderRadius: 12,
                }}>
                  {b.icon}
                </span>
                <div>
                  <div style={{ color: "#ffffff", fontWeight: 700, fontSize: ".9rem", marginBottom: 4 }}>
                    {b.title}
                  </div>
                  <div style={{ color: "rgba(255,255,255,.5)", fontSize: ".82rem", lineHeight: 1.65 }}>
                    {b.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Smartphone ── */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{
              /* Cadre téléphone */
              width: 300,
              height: 560,
              borderRadius: 44,
              border: "3px solid rgba(255,255,255,.12)",
              background: "linear-gradient(160deg,#1a1a2e,#0f0f1a)",
              boxShadow: "0 30px 90px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05), inset 0 1px 0 rgba(255,255,255,.1)",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}>

              {/* Notch */}
              <div style={{
                position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
                width: 100, height: 26, background: "#0f0f1a",
                borderRadius: 999, zIndex: 10,
              }} />

              {/* Header Telegram */}
              <div style={{
                flexShrink: 0,
                background: "linear-gradient(135deg,#1a1f3a,#2d1b4e)",
                padding: "48px 14px 12px",
                display: "flex", alignItems: "center", gap: 10,
                borderBottom: "1px solid rgba(255,255,255,.07)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>🤖</div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: ".82rem" }}>VTC Agent IA</div>
                  <div style={{ color: "#22c55e", fontSize: ".67rem", fontWeight: 600 }}>● en ligne</div>
                </div>
              </div>

              {/* Zone messages — scroll CSS infini */}
              <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                {/* Gradient fade haut */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 40,
                  background: "linear-gradient(to bottom,#1a1f3a,transparent)",
                  zIndex: 5, pointerEvents: "none",
                }} />
                {/* Gradient fade bas */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: 40,
                  background: "linear-gradient(to top,#0f0f1a,transparent)",
                  zIndex: 5, pointerEvents: "none",
                }} />

                <div className="chat-scroll" style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {doubled.map((msg, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        flexDirection: msg.role === "user" ? "row-reverse" : "row",
                        gap: 6, alignItems: "flex-end",
                      }}
                    >
                      {msg.role === "bot" && (
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11,
                        }}>🤖</div>
                      )}
                      <div style={{
                        maxWidth: "82%",
                        background: msg.role === "user"
                          ? "linear-gradient(135deg,#6366f1,#4f46e5)"
                          : "rgba(255,255,255,.09)",
                        borderRadius: msg.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                        padding: "8px 11px",
                        border: msg.role === "bot" ? "1px solid rgba(255,255,255,.07)" : "none",
                      }}>
                        <div style={{
                          color: msg.role === "user" ? "#fff" : "rgba(255,255,255,.85)",
                          fontSize: ".7rem", lineHeight: 1.55, whiteSpace: "pre-line",
                        }}>
                          {msg.text}
                        </div>
                        <div style={{
                          color: "rgba(255,255,255,.35)", fontSize: ".6rem",
                          textAlign: "right", marginTop: 3,
                        }}>{msg.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Input factice */}
              <div style={{
                flexShrink: 0,
                background: "rgba(255,255,255,.05)",
                borderTop: "1px solid rgba(255,255,255,.07)",
                padding: "10px 12px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{
                  flex: 1, background: "rgba(255,255,255,.08)",
                  borderRadius: 999, padding: "7px 12px",
                  color: "rgba(255,255,255,.3)", fontSize: ".7rem",
                }}>
                  Message...
                </div>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13,
                }}>➤</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Animation CSS scroll infini */}
      <style>{`
        .chat-scroll {
          animation: chatScroll 40s linear infinite;
        }
        @keyframes chatScroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
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
