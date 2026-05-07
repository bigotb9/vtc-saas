"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, Wallet, Car, Users, Bell, FileText, Sparkles } from "lucide-react"

/**
 * Landing page VTC Dashboard — version améliorée avec hero Three.js.
 * Route publique : /vtc-dashboard
 *
 * Hero : scène Abidjan night 3D (vtc-hero-embed.html) en iframe fullscreen
 * + overlay texte animé (framer-motion) + panel KPI glassmorphism.
 */

const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
  }),
}

export default function VtcDashboardPage() {
  return (
    <div className="bg-white dark:bg-[#0A0F1A] min-h-screen">

      {/* ════════════════════════════════════════
          HERO — 100vh avec scène 3D en iframe
      ════════════════════════════════════════ */}
      <section className="relative w-full overflow-hidden" style={{ height: "100dvh" }}>

        {/* Scène Three.js en iframe — plein fond, pointer-events:none */}
        <iframe
          src="/vtc-hero-embed.html"
          className="absolute inset-0 w-full h-full border-0"
          style={{ pointerEvents: "none" }}
          aria-hidden
          title="Scène 3D VTC Dashboard"
        />

        {/* Gradient overlay gauche pour lisibilité du texte */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, rgba(3,4,20,0.88) 0%, rgba(3,4,20,0.62) 42%, rgba(3,4,20,0.22) 65%, transparent 78%)",
            zIndex: 5,
          }}
        />

        {/* Gradient overlay haut (navbar safe zone) */}
        <div
          className="absolute top-0 left-0 right-0 h-28 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(3,4,20,.7), transparent)", zIndex: 5 }}
        />

        {/* Navigation flottante */}
        <nav className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-8 py-5">
          <Link href="/vtc-dashboard" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#FF4500] text-white">
              <Car size={16} />
            </span>
            <span className="text-white font-bold text-base tracking-tight">VTC Dashboard</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-white/70 hover:text-white transition">Fonctionnalités</a>
            <Link href="/pricing" className="text-white/70 hover:text-white transition">Tarifs</Link>
            <a href="#contact" className="text-white/70 hover:text-white transition">Contact</a>
          </div>
          <Link
            href="/signup"
            className="rounded-full bg-[#FF4500] hover:bg-[#e03d00] text-white text-sm font-semibold px-5 py-2.5 transition shadow-lg shadow-orange-600/30"
          >
            Commencer
          </Link>
        </nav>

        {/* Texte overlay — gauche, centré verticalement */}
        <div
          className="absolute left-0 top-0 bottom-0 flex items-center z-20"
          style={{ paddingLeft: "clamp(5%, 8vw, 10%)", maxWidth: "52%" }}
        >
          <div className="space-y-6">

            {/* Eyebrow badge */}
            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={0}
              className="inline-flex items-center gap-2.5"
            >
              <span
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-4 py-2 rounded-full"
                style={{
                  background: "rgba(255,69,0,.14)",
                  border: "1px solid rgba(255,69,0,.38)",
                  color: "#FF8C55",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500] animate-pulse" />
                Fait pour la Côte d&apos;Ivoire · Wave · Yango
              </span>
            </motion.div>

            {/* H1 */}
            <motion.h1
              variants={fadeUp} initial="hidden" animate="visible" custom={1}
              className="font-extrabold leading-[1.05] text-white"
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(2.2rem, 4.8vw, 3.8rem)",
              }}
            >
              Pilotez votre flotte VTC<br />
              <span
                style={{
                  background: "linear-gradient(135deg, #FF4500 0%, #FF8C00 50%, #FFD700 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                avec une précision absolue
              </span>
            </motion.h1>

            {/* Paragraph */}
            <motion.p
              variants={fadeUp} initial="hidden" animate="visible" custom={2}
              className="leading-relaxed max-w-[430px]"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "clamp(.9rem, 1.4vw, 1.1rem)",
                color: "rgba(255,255,255,0.72)",
              }}
            >
              Recettes Wave en temps réel, classement Yango, alertes chauffeurs, rapports PDF —
              tout votre business dans un tableau de bord pensé pour Abidjan.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={3}
              className="flex flex-wrap gap-3"
            >
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full text-white font-bold text-sm px-6 py-3.5 transition"
                style={{
                  background: "linear-gradient(135deg,#FF4500,#FF6A00)",
                  boxShadow: "0 0 28px rgba(255,69,0,.45)",
                }}
              >
                Commencer maintenant <ArrowRight size={16} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full font-semibold text-sm px-6 py-3.5 text-white transition"
                style={{
                  background: "rgba(255,255,255,.07)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,.16)",
                }}
              >
                Voir les tarifs
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Fade bottom vers la section suivante */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: 120,
            background: "linear-gradient(to bottom, transparent, #ffffff)",
            zIndex: 10,
          }}
        />
      </section>


      {/* ════════════════════════════════════════
          TRUST BAR
      ════════════════════════════════════════ */}
      <section className="bg-white dark:bg-[#0A0F1A] border-b border-gray-200/60 dark:border-white/5 py-5">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {[
            { icon: CheckCircle2, text: "Données isolées par client" },
            { icon: Wallet,        text: "Paiement Wave — activation immédiate" },
            { icon: Sparkles,      text: "IA sans surcoût sur Platinum" },
          ].map((it) => (
            <div key={it.text} className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300">
              <it.icon size={15} className="text-[#FF4500]" />
              {it.text}
            </div>
          ))}
        </div>
      </section>


      {/* ════════════════════════════════════════
          FEATURES
      ════════════════════════════════════════ */}
      <section id="features" className="bg-white dark:bg-[#0A0F1A] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Tout ce qu&apos;il faut pour gérer votre flotte
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Une plateforme unique pour remplacer cahiers, Excel et applications éparpillées.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Car,        title: "Gestion véhicules",   text: "Documents, entretiens, dépenses, fiches PDF par véhicule." },
              { icon: Users,      title: "Chauffeurs",          text: "Affectations, classement performance, alertes régularité." },
              { icon: Wallet,     title: "Recettes Wave",       text: "Import automatique, attribution intelligente par jour." },
              { icon: Bell,       title: "Alertes proactives",  text: "Documents expirés, paiements en retard, échéances." },
              { icon: FileText,   title: "Rapports PDF",        text: "Bilans mensuels, fiches véhicules, exports comptables." },
              { icon: Sparkles,   title: "AI Insights",         text: "Détection chauffeurs à risque, anticipation réparations." },
            ].map((f) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] p-6 hover:border-[#FF4500]/40 transition"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/15 text-[#FF4500] mb-4">
                  <f.icon size={20} />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════
          PRICING TEASER
      ════════════════════════════════════════ */}
      <section className="py-16 bg-gray-50 dark:bg-white/[0.02] border-y border-gray-200/60 dark:border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Une tarification simple</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xl mx-auto">
            Choisissez le plan adapté à la taille de votre flotte. Changez de plan à tout moment.
          </p>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto mb-8">
            {[
              "3 plans : Silver, Gold, Platinum",
              "Facturation mensuelle ou annuelle (-15%)",
              "Paiement via Wave CI",
              "Activation immédiate après paiement confirmé",
            ].map((p) => (
              <li key={p} className="flex items-start gap-2 text-left text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                {p}
              </li>
            ))}
          </ul>

          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full text-white font-medium px-6 py-3 transition"
            style={{ background: "linear-gradient(135deg,#FF4500,#FF6A00)" }}
          >
            Voir les 3 plans <ArrowRight size={18} />
          </Link>
        </div>
      </section>


      {/* ════════════════════════════════════════
          FINAL CTA
      ════════════════════════════════════════ */}
      <section id="contact" className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div
            className="rounded-3xl p-10 md:p-14 text-center text-white"
            style={{ background: "linear-gradient(135deg, #FF4500 0%, #FF8C00 60%, #FFD700 100%)" }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Prêt à reprendre le contrôle de votre flotte ?
            </h2>
            <p className="text-white/90 max-w-xl mx-auto mb-8">
              Rejoignez les flottes VTC qui simplifient leur gestion quotidienne avec VTC Dashboard.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-white text-[#FF4500] hover:bg-orange-50 font-bold px-7 py-3.5 transition shadow-xl"
            >
              Commencer maintenant <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/60 dark:border-white/5 py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} VTC Dashboard — Abidjan, Côte d&apos;Ivoire — contact@vtcdashboard.com
      </footer>

    </div>
  )
}
