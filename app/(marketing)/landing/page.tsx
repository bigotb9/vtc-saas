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
      <PricingTeaser />
      <FinalCta />
    </>
  )
}


// ────────── Hero ── scène Three.js Abidjan night ──────────

function Hero() {
  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "#030810",
      }}
    >
      {/* Scène Three.js (three.min.js classique, pas d'importmap) */}
      <iframe
        src="/vtc-hero-embed.html"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          pointerEvents: "none",
        }}
        aria-hidden
        title="Scène 3D"
      />

      {/* Gradient gauche — lisibilité texte */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg,rgba(3,4,20,.9) 0%,rgba(3,4,20,.65) 40%,rgba(3,4,20,.22) 62%,transparent 76%)",
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {/* Texte overlay — gauche, centré verticalement */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          paddingLeft: "clamp(5%,8vw,10%)",
          maxWidth: "52%",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>

          {/* Badge eyebrow */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            fontSize: "11px", fontWeight: 700, letterSpacing: ".12em",
            textTransform: "uppercase",
            background: "rgba(255,69,0,.14)",
            border: "1px solid rgba(255,69,0,.38)",
            color: "#FF8C55",
            padding: "5px 14px", borderRadius: "999px",
            width: "fit-content",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#FF4500",
              animation: "pulse 2s infinite",
            }} />
            Fait pour la Côte d&apos;Ivoire · Wave · Yango
          </span>

          {/* H1 */}
          <h1 style={{
            fontSize: "clamp(2.1rem,4.6vw,3.7rem)",
            fontWeight: 800,
            lineHeight: 1.06,
            color: "#ffffff",
            margin: 0,
          }}>
            Pilotez votre flotte VTC<br />
            <span style={{
              background: "linear-gradient(135deg,#FF4500 0%,#FF8C00 50%,#FFD700 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              avec une précision absolue
            </span>
          </h1>

          {/* Paragraph */}
          <p style={{
            fontSize: "clamp(.9rem,1.35vw,1.08rem)",
            color: "rgba(255,255,255,.7)",
            lineHeight: 1.7,
            maxWidth: 420,
            margin: 0,
          }}>
            Recettes Wave en temps réel, classement Yango, alertes chauffeurs,
            rapports PDF — tout votre business dans un tableau de bord pensé
            pour Abidjan.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <Link
              href="/signup"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "linear-gradient(135deg,#FF4500,#FF6A00)",
                color: "#fff", fontWeight: 700, fontSize: ".92rem",
                padding: "13px 26px", borderRadius: "999px", textDecoration: "none",
                boxShadow: "0 0 28px rgba(255,69,0,.42)",
              }}
            >
              Commencer maintenant
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,.18)",
                color: "#fff", fontWeight: 600, fontSize: ".92rem",
                padding: "13px 26px", borderRadius: "999px", textDecoration: "none",
              }}
            >
              Voir les tarifs
            </Link>
          </div>

        </div>
      </div>

      {/* Fade bottom → #fff pour transition vers sections suivantes */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 120,
          background: "linear-gradient(to bottom,transparent,#ffffff)",
          zIndex: 10, pointerEvents: "none",
        }}
      />

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5;transform:scale(1.3)}}`}</style>
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
