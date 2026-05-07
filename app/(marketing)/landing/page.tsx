"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion"
import AgentSection from "./AgentSection"

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const NAV_LINKS = [
  { href: "#features",  label: "Fonctionnalités" },
  { href: "#insights",  label: "AI Insights" },
  { href: "#yango",     label: "Yango" },
  { href: "#pricing",   label: "Tarifs" },
]

const STATS = [
  { value: 2847400, suffix: " F",  label: "CA géré / mois",    color: "#FF4500" },
  { value: 312,     suffix: "",    label: "Flottes actives",    color: "#00D4FF" },
  { value: 4200,    suffix: "+",   label: "Chauffeurs suivis",  color: "#FFD700" },
]

const FEATURES = [
  { icon: "🚗", title: "Gestion véhicules",  text: "Documents, entretiens, dépenses, fiches PDF par véhicule." },
  { icon: "👥", title: "Chauffeurs",         text: "Affectations, classement performance, alertes régularité." },
  { icon: "💳", title: "Recettes Wave",      text: "Import automatique, attribution intelligente par jour." },
  { icon: "🔔", title: "Alertes proactives", text: "Documents expirés, paiements en retard, échéances." },
  { icon: "📄", title: "Rapports PDF",       text: "Bilans mensuels, fiches véhicules, exports comptables." },
  { icon: "✨", title: "AI Insights",        text: "Scores chauffeurs, maintenance prédictive, anomalies." },
]

const AI_FEATURES = [
  { icon: "🎯", tag: "Analyse",     title: "Score chauffeurs en temps réel",       text: "Score composite (CA · régularité · tendance). Identifiez qui performe et qui décroche en un coup d'œil." },
  { icon: "🔧", tag: "Anticipation",title: "Maintenance prédictive",               text: "Périodicité moyenne calculée → prochaine intervention prédite avant la panne." },
  { icon: "📊", tag: "Coûts",       title: "Dépenses récurrentes & anomalies",     text: "Détection automatique des hausses suspectes +50 % vs période précédente." },
  { icon: "💰", tag: "Prévisionnel",title: "Prévision trésorerie 7 jours",         text: "Basée sur 30j d'historique avec indice de confiance pour anticiper votre cashflow." },
  { icon: "📱", tag: "Comm.",       title: "Messages WhatsApp pré-rédigés",        text: "Un message personnalisé adapté à la situation réelle de chaque chauffeur à risque." },
  { icon: "📈", tag: "Pilotage",    title: "Coefficient de variation",             text: "Mesure la stabilité de vos recettes. CV bas = flotte régulière. CV élevé = à corriger." },
]

const YANGO_FEATURES = [
  { icon: "📊", tag: "Live",         title: "Dashboard courses Yango",          text: "CA, courses, annulations, heures de pointe — synchronisation automatique en temps réel." },
  { icon: "🏆", tag: "Performance",  title: "Classement par performance",       text: "Chaque chauffeur classé par CA, taux de complétion et régularité sur votre parc Yango." },
  { icon: "🔄", tag: "Automatisation",title: "Synchro automatique commandes",  text: "Toutes les courses remontent dans votre base. Historique complet, filtres puissants." },
  { icon: "💸", tag: "Rentabilité",  title: "Suivi commissions opérateur",      text: "Commission 2,5 % calculée automatiquement et visualisée semaine par semaine." },
  { icon: "📱", tag: "Communication",title: "WhatsApp de relance Yango",        text: "Messages personnalisés pour chauffeurs inactifs, adaptés à leur historique Yango." },
  { icon: "🚗", tag: "Centralisé",   title: "Gestion flotte centralisée",       text: "Prestataires, véhicules Yango et VTC classiques — une seule interface de pilotage." },
]

const PLANS = [
  {
    id: "silver", name: "Silver", price: "50 000", period: "/ mois", accent: "#94a3b8",
    desc: "Pour démarrer et gérer votre flotte en toute simplicité.",
    features: ["15 véhicules max", "3 utilisateurs", "Recettes Wave", "Alertes documents", "Rapports PDF"],
    notIncluded: ["Partenariat Yango", "AI Insights", "Agent IA VTC"],
  },
  {
    id: "gold", name: "Gold", price: "100 000", period: "/ mois", accent: "#FFD700",
    desc: "Pour les flottes en croissance avec partenariat Yango.",
    features: ["40 véhicules max", "8 utilisateurs", "Tout Silver +", "Partenariat Yango", "Gestion flotte tiers"],
    notIncluded: ["AI Insights (option)", "Agent IA (option)"],
    highlight: true,
  },
  {
    id: "platinum", name: "Platinum", price: "200 000", period: "/ mois", accent: "#FF4500",
    desc: "Pour les grandes flottes avec IA et agent personnalisé.",
    features: ["Véhicules illimités", "Utilisateurs illimités", "Tout Gold +", "AI Insights inclus", "Agent IA VTC inclus"],
    notIncluded: [],
  },
]

/* ─────────────────────────────────────────────
   HOOKS & UTILS
───────────────────────────────────────────── */
function useCountUp(target: number, duration = 2000, trigger: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!trigger) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [trigger, target, duration])
  return count
}

function RevealText({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   CURSOR
───────────────────────────────────────────── */
function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 })
  const [hov, setHov] = useState(false)
  useEffect(() => {
    const mv = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
    const on = () => setHov(true)
    const off = () => setHov(false)
    window.addEventListener("mousemove", mv)
    document.querySelectorAll("a,button").forEach(el => { el.addEventListener("mouseenter", on); el.addEventListener("mouseleave", off) })
    return () => window.removeEventListener("mousemove", mv)
  }, [])
  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[9999] hidden md:block"
      animate={{ x: pos.x - (hov ? 20 : 6), y: pos.y - (hov ? 20 : 6), scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.4 }}
    >
      <div style={{
        width: hov ? 40 : 12, height: hov ? 40 : 12,
        borderRadius: hov ? 12 : "50%",
        background: hov ? "rgba(255,69,0,.18)" : "#FF4500",
        border: hov ? "1.5px solid rgba(255,69,0,.6)" : "none",
        backdropFilter: hov ? "blur(4px)" : "none",
        transition: "all .25s cubic-bezier(.22,1,.36,1)",
      }} />
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   NAV
───────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h)
  }, [])
  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ duration: .8, delay: .2, ease: [.22, 1, .36, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16 transition-all"
      style={{
        background: scrolled ? "rgba(3,8,16,.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,.06)" : "none",
      }}
    >
      <Link href="/" className="flex items-center gap-2.5 select-none">
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: "linear-gradient(135deg,#FF4500,#FF6A00)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(255,69,0,.45)",
        }}>
          <span style={{ color: "#fff", fontSize: 16 }}>🚗</span>
        </div>
        <span className="text-white font-bold text-base">VTC Dashboard</span>
      </Link>

      <div className="hidden md:flex items-center gap-7 text-sm">
        {NAV_LINKS.map(l => (
          <a key={l.href} href={l.href} className="text-white/60 hover:text-white transition-colors">{l.label}</a>
        ))}
      </div>

      <Link href="/signup" className="hidden md:inline-flex items-center gap-2 rounded-full text-white text-sm font-semibold px-5 py-2.5 transition"
        style={{
          background: "linear-gradient(135deg,#FF4500,#FF6A00)",
          boxShadow: "0 2px 16px rgba(255,69,0,.35)",
        }}>
        Commencer
      </Link>
    </motion.nav>
  )
}

/* ─────────────────────────────────────────────
   HERO
───────────────────────────────────────────── */
function Hero() {
  const { scrollYProgress } = useScroll()
  const y = useTransform(scrollYProgress, [0, .3], [0, -80])
  const opacity = useTransform(scrollYProgress, [0, .25], [1, 0])

  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "100vh", background: "#030810" }}>

      {/* Gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translate(-50%,-50%)",
          width: 800, height: 800, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(255,69,0,.12) 0%,rgba(255,69,0,.04) 40%,transparent 70%)",
          filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", top: "60%", right: "10%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(0,212,255,.08) 0%,transparent 70%)",
          filter: "blur(50px)",
        }} />
      </div>

      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Content */}
      <motion.div style={{ y, opacity }}
        className="relative flex flex-col items-center justify-center text-center px-6 pt-36 pb-16"
      >
        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .7 }}>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8"
            style={{ background: "rgba(255,69,0,.12)", border: "1px solid rgba(255,69,0,.3)", color: "#FF8C55" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500] animate-pulse" />
            Fait pour la Côte d&apos;Ivoire · Wave · Yango
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .45, duration: .8, ease: [.22, 1, .36, 1] }}
          className="text-white leading-[1.03] mb-6"
          style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(2.6rem,7vw,6rem)", fontWeight: 800, maxWidth: 900 }}>
          Pilotez votre flotte VTC<br />
          <span style={{
            background: "linear-gradient(135deg,#FF4500 0%,#FF8C00 50%,#FFD700 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>avec une précision absolue</span>
        </motion.h1>

        {/* Sub */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .6, duration: .7 }}
          className="max-w-xl leading-relaxed mb-10 text-lg"
          style={{ color: "rgba(255,255,255,.6)", fontFamily: "'Space Grotesk',sans-serif" }}>
          Recettes Wave en temps réel, classement Yango, alertes chauffeurs, rapports PDF —
          tout votre business dans un tableau de bord pensé pour Abidjan.
        </motion.p>

        {/* CTAs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .75, duration: .6 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link href="/signup"
            className="group relative inline-flex items-center gap-2.5 rounded-full text-white font-bold text-sm px-7 py-4 overflow-hidden transition-all"
            style={{ background: "linear-gradient(135deg,#FF4500,#FF6A00)", boxShadow: "0 0 30px rgba(255,69,0,.4)" }}>
            <span className="relative z-10">Commencer maintenant</span>
            <span className="relative z-10 transition-transform group-hover:translate-x-1">→</span>
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "linear-gradient(135deg,#FF6A00,#FF4500)" }} />
          </Link>
          <a href="#features"
            className="inline-flex items-center gap-2 rounded-full font-semibold text-sm px-7 py-4 text-white transition-all hover:bg-white/10"
            style={{ background: "rgba(255,255,255,.06)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.12)" }}>
            Voir la démo ↓
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .9, duration: .7 }}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {STATS.map((s, i) => <StatBadge key={i} {...s} delay={i * 100} />)}
        </motion.div>
      </motion.div>

      {/* Fade bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom,transparent,#030810)" }} />
    </section>
  )
}

function StatBadge({ value, suffix, label, color, delay }: { value: number; suffix: string; label: string; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const count = useCountUp(value, 2000, inView)
  return (
    <div ref={ref} className="text-center">
      <div className="text-2xl md:text-3xl font-black" style={{ color, fontFamily: "'Syne',sans-serif" }}>
        {count.toLocaleString("fr-FR")}{suffix}
      </div>
      <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,.4)", letterSpacing: ".06em" }}>{label}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   FEATURES
───────────────────────────────────────────── */
function Features() {
  return (
    <section id="features" className="py-24" style={{ background: "#030810" }}>
      <div className="max-w-6xl mx-auto px-6">
        <RevealText className="text-center mb-4">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full"
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)" }}>
            Plateforme complète
          </span>
        </RevealText>
        <RevealText className="text-center mb-4" delay={.1}>
          <h2 className="text-3xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Syne',sans-serif" }}>
            Tout ce qu&apos;il faut pour<br />
            <span style={{ color: "#FF4500" }}>gérer votre flotte</span>
          </h2>
        </RevealText>
        <RevealText className="text-center mb-10" delay={.15}>
          <p className="text-white/50 max-w-lg mx-auto">
            Une plateforme unique pour remplacer cahiers, Excel et applications éparpillées.
          </p>
        </RevealText>

        {/* Video */}
        <RevealText delay={.2} className="mb-14">
          <div className="rounded-2xl overflow-hidden border shadow-2xl" style={{ borderColor: "rgba(255,255,255,.08)", boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}>
            <video src="/demo.mp4" autoPlay loop muted playsInline disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback"
              className="w-full block pointer-events-none" />
          </div>
        </RevealText>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <RevealText key={f.title} delay={i * .05}>
              <motion.div whileHover={{ y: -4, borderColor: "rgba(255,69,0,.35)" }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="rounded-2xl p-5 h-full transition-all cursor-default"
                style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div className="text-2xl mb-3">{f.icon}</div>
                <div className="text-white font-semibold text-sm mb-1.5">{f.title}</div>
                <div className="text-white/45 text-xs leading-relaxed">{f.text}</div>
              </motion.div>
            </RevealText>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   AI INSIGHTS
───────────────────────────────────────────── */
function AiInsightsSection() {
  return (
    <section id="insights" className="py-24 relative overflow-hidden" style={{ background: "linear-gradient(180deg,#030810 0%,#0d0522 50%,#030810 100%)" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400,
          background: "radial-gradient(ellipse,rgba(139,92,246,.15) 0%,transparent 70%)",
          filter: "blur(60px)",
        }} />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
          <div>
            <RevealText>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-5"
                style={{ background: "rgba(139,92,246,.15)", border: "1px solid rgba(139,92,246,.3)", color: "#a78bfa" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                Option · +15 000 F/mois · Inclus Platinum
              </span>
            </RevealText>
            <RevealText delay={.1}>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: "'Syne',sans-serif" }}>
                AI Insights —<br />
                <span style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  votre flotte analysée en continu
                </span>
              </h2>
            </RevealText>
            <RevealText delay={.15}>
              <p className="text-white/50 leading-relaxed mb-8">
                Moteur d&apos;analyse algorithmique 100 % automatique. Scores, prédictions, anomalies —
                sans Claude, sans coût IA supplémentaire.
              </p>
            </RevealText>
            <RevealText delay={.2}>
              <div className="flex flex-wrap gap-2">
                {["Silver · +15 000 F/mois", "Gold · +15 000 F/mois", "Platinum · inclus"].map(p => (
                  <span key={p} className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: "rgba(139,92,246,.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,.22)" }}>{p}</span>
                ))}
              </div>
            </RevealText>
          </div>

          {/* Dashboard mock */}
          <RevealText delay={.25}>
            <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 200 }}
              className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,.25)", boxShadow: "0 30px 80px rgba(139,92,246,.15)" }}>
              <div className="p-5" style={{ background: "linear-gradient(160deg,#1e1b4b,#2e1065)" }}>
                <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                  <span className="text-base">🧠</span>
                  <span className="text-white font-bold text-sm">AI Insights · Rapport</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(34,197,94,.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,.25)" }}>● Live</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { l: "CA 30 jours",     v: "2 847 400 F", t: "+14% ↑", c: "#22c55e" },
                    { l: "Prévision 7j",    v: "664 000 F",   t: "Confiance élevée", c: "#a78bfa" },
                    { l: "Jours sans rec.", v: "3 / 30",       t: "Régularité 90%", c: "#fbbf24" },
                    { l: "CV régularité",   v: "22%",          t: "Flotte stable ✓", c: "#34d399" },
                  ].map(k => (
                    <div key={k.l} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)" }}>
                      <div className="text-[10px] text-white/35 mb-1">{k.l}</div>
                      <div className="font-bold text-white text-sm">{k.v}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: k.c }}>{k.t}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                  <div className="text-[10px] text-white/35 mb-2 uppercase tracking-wider font-semibold">Chauffeurs à surveiller</div>
                  {[{ nom: "Konan Koffi", label: "CA -38% · 3j inactif", risk: "critical" },
                    { nom: "Yapi Adjobi", label: "Régularité 52%", risk: "warn" }].map(d => (
                    <div key={d.nom} className="flex items-center gap-2 py-1">
                      <span style={{ color: d.risk === "critical" ? "#f87171" : "#fbbf24", fontSize: 11 }}>{d.risk === "critical" ? "🔴" : "🟡"}</span>
                      <span className="text-white/80 text-xs font-medium">{d.nom}</span>
                      <span className="text-white/35 text-[10px] ml-auto">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </RevealText>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AI_FEATURES.map((f, i) => (
            <RevealText key={f.title} delay={i * .05}>
              <motion.div whileHover={{ y: -3, borderColor: "rgba(139,92,246,.35)" }} transition={{ type: "spring", stiffness: 300 }}
                className="rounded-2xl p-5 transition-all"
                style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(139,92,246,.15)" }}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl">{f.icon}</span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#a78bfa" }}>{f.tag}</div>
                    <div className="text-white font-semibold text-sm">{f.title}</div>
                  </div>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">{f.text}</p>
              </motion.div>
            </RevealText>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   YANGO
───────────────────────────────────────────── */
function YangoSection() {
  return (
    <section id="yango" className="py-24 relative overflow-hidden" style={{ background: "#030810" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: "absolute", top: "40%", right: "0%",
          width: 500, height: 500,
          background: "radial-gradient(circle,rgba(245,158,11,.1) 0%,transparent 70%)",
          filter: "blur(60px)",
        }} />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">

          {/* Mock */}
          <RevealText delay={.15}>
            <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 200 }}
              className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(245,158,11,.2)", boxShadow: "0 30px 80px rgba(245,158,11,.1)" }}>
              <div className="p-5" style={{ background: "linear-gradient(160deg,#0f172a,#1e293b)" }}>
                <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-base"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}>Y</div>
                  <div>
                    <div className="text-white font-bold text-sm">Partenariat Yango</div>
                    <div className="text-white/30 text-xs">Synchro · il y a 3 min</div>
                  </div>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(34,197,94,.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,.22)" }}>● Connecté</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[{ l: "CA semaine", v: "494 100 F", c: "#fbbf24" }, { l: "Courses", v: "312", c: "#60a5fa" }, { l: "Commission", v: "12 350 F", c: "#34d399" }].map(k => (
                    <div key={k.l} className="rounded-lg p-2.5 text-center" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                      <div className="font-bold text-sm" style={{ color: k.c }}>{k.v}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{k.l}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.05)" }}>
                  <div className="text-[10px] text-white/30 mb-2 uppercase tracking-wider font-semibold">Top chauffeurs</div>
                  {[{ pos: "🥇", n: "Kouamé Assi", ca: "127 500 F" }, { pos: "🥈", n: "Yapi Adjobi", ca: "115 800 F" }, { pos: "🥉", n: "Traoré Moussa", ca: "109 600 F" }].map(d => (
                    <div key={d.n} className="flex items-center gap-2 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,.03)" }}>
                      <span>{d.pos}</span>
                      <span className="text-white/75 text-xs font-medium flex-1">{d.n}</span>
                      <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>{d.ca}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </RevealText>

          <div>
            <RevealText>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-5"
                style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", color: "#fbbf24" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Inclus · Plans Gold & Platinum
              </span>
            </RevealText>
            <RevealText delay={.1}>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: "'Syne',sans-serif" }}>
                Partenariat Yango —<br />
                <span style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  pilotez votre flotte partenaire
                </span>
              </h2>
            </RevealText>
            <RevealText delay={.15}>
              <p className="text-white/50 leading-relaxed mb-6">
                Connectez vos credentials Yango Business et synchronisez automatiquement toutes vos courses.
                Classement, commissions, alertes — tout en un seul endroit.
              </p>
            </RevealText>
            <RevealText delay={.2}>
              <div className="flex gap-2">
                {["Gold · inclus", "Platinum · inclus"].map(p => (
                  <span key={p} className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: "rgba(245,158,11,.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,.2)" }}>{p}</span>
                ))}
              </div>
            </RevealText>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {YANGO_FEATURES.map((f, i) => (
            <RevealText key={f.title} delay={i * .05}>
              <motion.div whileHover={{ y: -3, borderColor: "rgba(245,158,11,.35)" }} transition={{ type: "spring", stiffness: 300 }}
                className="rounded-2xl p-5"
                style={{ background: "rgba(245,158,11,.025)", border: "1px solid rgba(245,158,11,.12)" }}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl">{f.icon}</span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#fbbf24" }}>{f.tag}</div>
                    <div className="text-white font-semibold text-sm">{f.title}</div>
                  </div>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">{f.text}</p>
              </motion.div>
            </RevealText>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   PRICING
───────────────────────────────────────────── */
function Pricing() {
  const [annual, setAnnual] = useState(false)
  return (
    <section id="pricing" className="py-24" style={{ background: "#030810" }}>
      <div className="max-w-6xl mx-auto px-6">
        <RevealText className="text-center mb-4">
          <h2 className="text-3xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Syne',sans-serif" }}>
            Tarification <span style={{ color: "#FF4500" }}>simple</span>
          </h2>
        </RevealText>
        <RevealText delay={.1} className="text-center mb-8">
          <p className="text-white/50">Choisissez le plan adapté à votre flotte.</p>
        </RevealText>

        {/* Toggle */}
        <RevealText delay={.15} className="flex justify-center mb-12">
          <div className="flex items-center gap-4 text-sm">
            <span className={annual ? "text-white/40" : "text-white font-semibold"}>Mensuel</span>
            <button onClick={() => setAnnual(a => !a)}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{ background: annual ? "#FF4500" : "rgba(255,255,255,.15)" }}>
              <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: annual ? "auto" : "4px", right: annual ? "4px" : "auto" }} />
            </button>
            <span className={annual ? "text-white font-semibold" : "text-white/40"}>
              Annuel <span className="text-emerald-400 font-bold">-15%</span>
            </span>
          </div>
        </RevealText>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((p, i) => {
            const price = annual ? Math.round(parseInt(p.price.replace(" ", "")) * 0.85).toLocaleString("fr-FR") : p.price
            return (
              <RevealText key={p.id} delay={i * .1}>
                <motion.div whileHover={{ y: p.highlight ? -8 : -4 }} transition={{ type: "spring", stiffness: 250 }}
                  className="relative rounded-2xl p-6 h-full flex flex-col"
                  style={{
                    background: p.highlight ? `rgba(255,255,255,.06)` : "rgba(255,255,255,.025)",
                    border: `1px solid ${p.highlight ? p.accent + "55" : "rgba(255,255,255,.08)"}`,
                    boxShadow: p.highlight ? `0 20px 60px ${p.accent}22` : "none",
                  }}>
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: "#FFD700", color: "#000" }}>
                      ⭐ Le plus populaire
                    </div>
                  )}
                  <div className="font-bold text-sm mb-1" style={{ color: p.accent }}>{p.name}</div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-black text-white" style={{ fontFamily: "'Syne',sans-serif" }}>{price}</span>
                    <span className="text-white/40 text-sm pb-1">FCFA{p.period}</span>
                  </div>
                  <p className="text-white/40 text-xs mb-5">{p.desc}</p>
                  <div className="space-y-2 mb-6 flex-1">
                    {p.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-white/75">
                        <span style={{ color: p.accent }}>✓</span>{f}
                      </div>
                    ))}
                    {p.notIncluded.map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-white/25">
                        <span>–</span>{f}
                      </div>
                    ))}
                  </div>
                  <Link href={`/signup?plan=${p.id}`}
                    className="w-full text-center rounded-full py-3 font-semibold text-sm transition-all"
                    style={{
                      background: p.highlight ? `linear-gradient(135deg,${p.accent},#FF6A00)` : "rgba(255,255,255,.08)",
                      color: "#fff",
                      border: p.highlight ? "none" : `1px solid rgba(255,255,255,.12)`,
                      boxShadow: p.highlight ? `0 4px 20px ${p.accent}40` : "none",
                    }}>
                    Choisir {p.name}
                  </Link>
                </motion.div>
              </RevealText>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   CTA FINAL
───────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: "#030810" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 50% at 50% 50%,rgba(255,69,0,.14) 0%,transparent 70%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
      </div>
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <RevealText>
          <div className="text-5xl mb-6">🚀</div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight" style={{ fontFamily: "'Syne',sans-serif" }}>
            Prêt à reprendre<br />
            <span style={{ background: "linear-gradient(135deg,#FF4500,#FFD700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              le contrôle de votre flotte ?
            </span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto mb-10 text-lg">
            Rejoignez les flottes VTC qui simplifient leur gestion quotidienne avec VTC Dashboard.
            Activation immédiate après paiement Wave.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/signup"
              className="group inline-flex items-center gap-3 rounded-full text-white font-bold px-8 py-4 transition-all"
              style={{ background: "linear-gradient(135deg,#FF4500,#FF6A00)", boxShadow: "0 0 40px rgba(255,69,0,.4)", fontSize: "1rem" }}>
              Commencer maintenant
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>→</motion.span>
            </Link>
            <Link href="/pricing"
              className="inline-flex items-center gap-2 rounded-full font-semibold px-8 py-4 text-white"
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", fontSize: "1rem" }}>
              Voir les tarifs
            </Link>
          </div>
        </RevealText>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="py-10 text-center text-sm border-t" style={{ background: "#020608", borderColor: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.25)" }}>
      © {new Date().getFullYear()} VTC Dashboard · Abidjan, Côte d&apos;Ivoire · contact@vtcdashboard.com
    </footer>
  )
}

/* ─────────────────────────────────────────────
   LENIS SMOOTH SCROLL
───────────────────────────────────────────── */
function SmoothScroll() {
  useEffect(() => {
    let lenis: import("lenis").default | null = null
    import("lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({ lerp: 0.08, smoothWheel: true })
      function raf(time: number) { lenis?.raf(time); requestAnimationFrame(raf) }
      requestAnimationFrame(raf)
    })
    return () => { lenis?.destroy() }
  }, [])
  return null
}

/* ─────────────────────────────────────────────
   PAGE ROOT
───────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div style={{ background: "#030810", cursor: "none" }}>
      <CustomCursor />
      <SmoothScroll />
      <Nav />
      <Hero />
      <Features />
      <AiInsightsSection />
      <YangoSection />
      <AgentSection />
      <Pricing />
      <FinalCta />
      <Footer />
    </div>
  )
}
