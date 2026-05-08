"use client"

import Link from "next/link"
import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Check, Minus, ArrowLeft } from "lucide-react"
import {
  formatFcfa,
  type Addon,
  type BillingCycle,
  type Plan,
} from "@/lib/plans"

/* ─── Plan meta ─────────────────────────────────────────────── */
const PLAN_META: Record<string, { accent: string; glow: string; badge?: string; popular?: boolean }> = {
  silver:        { accent: "#94a3b8", glow: "rgba(148,163,184,.15)" },
  gold:          { accent: "#FFD700", glow: "rgba(255,215,0,.18)",  badge: "⭐ Le plus populaire", popular: true },
  platinum:      { accent: "#FF4500", glow: "rgba(255,69,0,.18)" },
  platinum_plus: { accent: "#a855f7", glow: "rgba(168,85,247,.18)", badge: "🚀 Grandes flottes" },
}

/* ─── Tableau comparatif ───────────────────────────────────── */
type CompRow = { section?: string; label: string; values: (string | boolean)[] }

function buildComparison(plans: Plan[]): CompRow[] {
  return [
    { section:"Quotas",       label:"Véhicules",                  values:plans.map(p=>p.maxVehicules ?`${p.maxVehicules}`:"∞") },
    {                         label:"Chauffeurs",                 values:plans.map(p=>p.maxChauffeurs?`${p.maxChauffeurs}`:"∞") },
    {                         label:"Utilisateurs",               values:plans.map(p=>p.maxUsers     ?`${p.maxUsers}`    :"∞") },
    { section:"Inclus",       label:"Tableau de bord & alertes",  values:plans.map(()=>true) },
    {                         label:"Gestion véhicules",          values:plans.map(()=>true) },
    {                         label:"Gestion chauffeurs",         values:plans.map(()=>true) },
    {                         label:"Recettes Wave intégrées",    values:plans.map(()=>true) },
    {                         label:"Rapports PDF",               values:plans.map(()=>true) },
    { section:"Options",      label:"Partenariat Yango",          values:plans.map(p=>p.features.yango       ?true:"Option") },
    {                         label:"Gestion flotte tiers",       values:plans.map(p=>p.features.fleet_clients?true:false) },
    {                         label:"AI Insights",                values:plans.map(p=>p.features.ai_insights  ?true:"Option") },
    {                         label:"Agent IA VTC",               values:plans.map(p=>p.features.ai_agent     ?true:"Option") },
    { section:"Support",      label:"Support standard",           values:plans.map(()=>true) },
    {                         label:"Support prioritaire",        values:plans.map(p=>p.id==="platinum_plus"?true:false) },
    { section:"Sur devis",    label:"> 300 véhicules",            values:plans.map(p=>p.id==="platinum_plus"?"Oui →":false) },
  ]
}

/* ─── Composant principal ──────────────────────────────────── */
export default function PricingClient({ plans, addons }: { plans: Plan[]; addons: Addon[] }) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly")
  const comparison = buildComparison(plans)

  return (
    <div style={{ background:"#030810", minHeight:"100vh", color:"#fff" }}>

      {/* Dot grid */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[.03]"
        style={{ backgroundImage:"radial-gradient(rgba(255,255,255,.8) 1px,transparent 1px)", backgroundSize:"40px 40px" }} />

      {/* Glow hero */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ background:"radial-gradient(ellipse 60% 40% at 50% 0%,rgba(255,69,0,.08) 0%,transparent 70%)" }} />

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 h-16 border-b"
        style={{ background:"rgba(3,8,16,.9)", backdropFilter:"blur(20px)", borderColor:"rgba(255,255,255,.06)" }}>
        <Link href="/landing" className="flex items-center gap-1.5 text-white/50 hover:text-white transition text-sm">
          <ArrowLeft size={14} /> Accueil
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <div style={{ width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#FF4500,#FF6A00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>🚗</div>
          <span className="font-bold text-sm hidden md:block">VTC Dashboard</span>
        </Link>
        <Link href="/signup" className="text-sm font-semibold text-white rounded-full px-4 py-2"
          style={{ background:"linear-gradient(135deg,#FF4500,#FF6A00)", boxShadow:"0 2px 12px rgba(255,69,0,.35)" }}>
          Commencer
        </Link>
      </nav>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-20 z-10">

        {/* ── HEADER ── */}
        <div className="text-center mb-16">
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.6}}>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6"
              style={{ background:"rgba(255,69,0,.1)", border:"1px solid rgba(255,69,0,.28)", color:"#FF8C55" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500] animate-pulse" />
              Transparent · Activation immédiate · Paiement Wave
            </span>
          </motion.div>

          <motion.h1 initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.1}}
            className="text-4xl md:text-6xl font-bold mb-4 leading-tight"
            style={{ fontFamily:"'Syne',sans-serif" }}>
            Une offre pour<br />
            <span style={{ background:"linear-gradient(135deg,#FF4500 0%,#FF8C00 50%,#FFD700 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
              chaque flotte
            </span>
          </motion.h1>

          <motion.p initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.18}}
            className="text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
            Choisissez le plan adapté à la taille de votre activité. Évoluez à tout moment, sans perte de données.
          </motion.p>

          {/* Toggle mensuel / annuel */}
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.5,delay:.25}}
            className="inline-flex p-1.5 rounded-full"
            style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.08)" }}>
            {(["monthly","yearly"] as const).map(c => (
              <button key={c} onClick={()=>setCycle(c)}
                className="px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2"
                style={{ background:cycle===c?"rgba(255,255,255,.12)":"transparent", color:cycle===c?"#fff":"rgba(255,255,255,.4)" }}>
                {c==="monthly" ? "Mensuel" : "Annuel"}
                {c==="yearly" && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{ background:cycle==="yearly"?"#22c55e":"rgba(34,197,94,.2)", color:cycle==="yearly"?"#fff":"#4ade80" }}>
                    -15%
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        </div>

        {/* ── CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {plans.map((plan, i) => {
            const meta = PLAN_META[plan.id] ?? { accent:"#94a3b8", glow:"rgba(255,255,255,.1)" }
            const monthly = cycle==="monthly" ? plan.priceMonthlyFcfa : Math.round(plan.priceYearlyFcfa/12)
            const saving  = cycle==="yearly" ? Math.round(plan.priceMonthlyFcfa*.15) : 0
            return (
              <motion.div key={plan.id}
                initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:.55,delay:i*.09}}
                whileHover={{y:-6,scale:1.01}} style={{ cursor:"default" }}>

                <div style={{
                  borderRadius:24, display:"flex", flexDirection:"column",
                  background: meta.popular
                    ? "linear-gradient(160deg,rgba(255,215,0,.07),rgba(255,69,0,.04))"
                    : "rgba(255,255,255,.03)",
                  border:`1px solid ${meta.popular?meta.accent+"44":"rgba(255,255,255,.07)"}`,
                  boxShadow: meta.popular ? `0 0 0 1px ${meta.accent}22, 0 24px 60px ${meta.glow}` : "none",
                  overflow:"hidden",
                }}>

                  {/* Badge */}
                  {meta.badge && (
                    <div className="text-center py-2 text-xs font-black uppercase tracking-widest"
                      style={{ background:meta.popular?"linear-gradient(90deg,#FFD700,#FF8C00)":`${meta.accent}22`,
                        color:meta.popular?"#000":meta.accent }}>
                      {meta.badge}
                    </div>
                  )}

                  <div className="p-6 flex flex-col flex-1">

                    {/* Header plan */}
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black"
                        style={{ background:`${meta.accent}1a`, color:meta.accent, border:`1px solid ${meta.accent}33` }}>
                        {plan.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{plan.name}</div>
                        <div className="text-[10px] text-white/30 leading-tight max-w-[150px] truncate">{plan.description.split(" — ")[0]}</div>
                      </div>
                    </div>

                    {/* Prix */}
                    <div className="mb-1">
                      <span className="text-4xl font-black text-white" style={{ fontFamily:"'Syne',sans-serif" }}>
                        {(monthly/1000).toLocaleString("fr-FR")}k
                      </span>
                      <span className="text-white/35 text-xs ml-1">FCFA / mois</span>
                    </div>
                    <div className="text-xs mb-5" style={{ color: saving>0 ? "#4ade80" : "rgba(255,255,255,.2)" }}>
                      {saving>0
                        ? `Économie ${Math.round(saving/1000)}k F/mois · ${formatFcfa(plan.priceYearlyFcfa)} / an`
                        : "Facturation mensuelle"}
                    </div>

                    {/* Quotas */}
                    <div className="grid grid-cols-3 gap-1.5 mb-5">
                      {[
                        { v:plan.maxVehicules,  l:"Véh." },
                        { v:plan.maxChauffeurs, l:"Chauf." },
                        { v:plan.maxUsers,      l:"Users" },
                      ].map(q=>(
                        <div key={q.l} className="text-center rounded-xl py-2"
                          style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.06)" }}>
                          <div className="font-bold text-sm leading-none mb-0.5" style={{ color:meta.accent }}>
                            {q.v??<span style={{fontSize:16}}>∞</span>}
                          </div>
                          <div className="text-[9px] text-white/25">{q.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Séparateur */}
                    <div className="mb-4" style={{ height:1, background:"rgba(255,255,255,.06)" }} />

                    {/* Features clés */}
                    <div className="space-y-2 mb-6 flex-1">
                      {[
                        { ok:true,                         label:"Tableau de bord & alertes" },
                        { ok:true,                         label:"Wave + Rapports PDF" },
                        { ok:plan.features.yango,          label:"Partenariat Yango",   option:!plan.features.yango },
                        { ok:plan.features.ai_insights,    label:"AI Insights",         option:!plan.features.ai_insights },
                        { ok:plan.features.ai_agent,       label:"Agent IA VTC",        option:!plan.features.ai_agent },
                        { ok:plan.id==="platinum_plus",    label:"Support prioritaire",  option:false },
                      ].map(f=>(
                        <div key={f.label} className="flex items-center gap-2 text-xs"
                          style={{ color:f.ok?"rgba(255,255,255,.75)":"rgba(255,255,255,.2)" }}>
                          <span style={{ color:f.ok?meta.accent:"rgba(255,255,255,.18)", fontWeight:700, fontSize:13 }}>
                            {f.ok?"✓":"—"}
                          </span>
                          {f.label}
                          {!f.ok && f.option && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto"
                              style={{ background:"rgba(251,191,36,.12)", color:"#fbbf24" }}>option</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <Link href={`/signup?plan=${plan.id}&cycle=${cycle}`}
                      className="block w-full text-center rounded-2xl py-3.5 font-bold text-sm transition-all"
                      style={{
                        background:meta.popular?"linear-gradient(135deg,#FFD700,#FF8C00)":"rgba(255,255,255,.07)",
                        color:meta.popular?"#000":"#fff",
                        border:meta.popular?"none":"1px solid rgba(255,255,255,.1)",
                        boxShadow:meta.popular?"0 6px 28px rgba(255,215,0,.22)":"none",
                      }}>
                      Démarrer avec {plan.name} →
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* ── SUR DEVIS ── */}
        <motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.5}}
          className="rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 mb-20"
          style={{ background:"rgba(0,212,255,.04)", border:"1px solid rgba(0,212,255,.18)" }}>
          <div>
            <div className="font-bold text-white mb-1 text-sm flex items-center gap-2">
              <span style={{color:"#00D4FF"}}>📋</span> Plus de 300 véhicules ?
            </div>
            <p className="text-xs text-white/45 max-w-xl leading-relaxed">
              Pour les très grandes flottes, nous proposons une offre sur mesure — tarif, intégrations spécifiques,
              SLA personnalisé et support dédié. Contactez-nous pour un devis adapté.
            </p>
          </div>
          <a href="mailto:contact@vtcdashboard.com"
            className="shrink-0 inline-flex items-center gap-2 rounded-full font-semibold text-sm px-5 py-3 transition-all"
            style={{ background:"rgba(0,212,255,.1)", border:"1px solid rgba(0,212,255,.28)", color:"#00D4FF" }}>
            Nous contacter <ArrowRight size={14} />
          </a>
        </motion.div>

        {/* ── TABLEAU COMPARATIF ── */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2" style={{fontFamily:"'Syne',sans-serif"}}>
              Comparaison point par point
            </h2>
            <p className="text-white/40 text-sm">Tout ce qui est inclus dans chaque plan.</p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,.07)"}}>
            {/* Header */}
            <div style={{display:"grid",gridTemplateColumns:`220px repeat(${plans.length},1fr)`,background:"rgba(255,255,255,.04)",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
              <div className="p-4 text-[10px] font-bold uppercase tracking-wider text-white/25">Fonctionnalité</div>
              {plans.map(p=>{
                const m=PLAN_META[p.id]??{accent:"#94a3b8"}
                return (
                  <div key={p.id} className="p-4 text-center">
                    <div className="text-sm font-bold" style={{color:m.accent}}>{p.name}</div>
                  </div>
                )
              })}
            </div>

            {/* Rows */}
            {comparison.map((row,i)=>(
              <div key={row.label}>
                {row.section && (
                  <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white/20"
                    style={{background:"rgba(255,255,255,.02)",borderTop:"1px solid rgba(255,255,255,.05)"}}>
                    {row.section}
                  </div>
                )}
                <div style={{
                  display:"grid",gridTemplateColumns:`220px repeat(${plans.length},1fr)`,
                  borderTop:row.section?"none":"1px solid rgba(255,255,255,.04)",
                  background:i%2===0?"rgba(255,255,255,.01)":"transparent",
                }}>
                  <div className="px-4 py-3 text-xs text-white/50">{row.label}</div>
                  {row.values.map((val,j)=>{
                    const m=PLAN_META[plans[j]?.id]??{accent:"#94a3b8"}
                    return (
                      <div key={j} className="px-4 py-3 text-center text-xs flex items-center justify-center">
                        {val===true  ? <Check  size={15} style={{color:m.accent}} />
                        :val===false ? <Minus  size={14} className="text-white/15" />
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background:val==="Option"?"rgba(251,191,36,.12)":"rgba(0,212,255,.1)",
                              color:val==="Option"?"#fbbf24":"#00D4FF",
                            }}>
                            {val}
                          </span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ADDONS ── */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2" style={{fontFamily:"'Syne',sans-serif"}}>
              Options disponibles
            </h2>
            <p className="text-white/40 text-sm">
              Activables sur Silver & Gold · Incluses dans Platinum et Platinum+
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {addons.filter(a=>a.priceMonthlyFcfa!==null||a.id!=="gps").map((a,i)=>(
              <motion.div key={a.id}
                initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.08,duration:.5}}
                whileHover={{y:-4}}
                className="rounded-2xl p-5"
                style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)"}}>
                <div className="text-2xl mb-3">{a.id==="ai_insights"?"✨":a.id==="ai_agent"?"🤖":"📍"}</div>
                <div className="font-bold text-white text-sm mb-1">{a.name}</div>
                <p className="text-xs text-white/40 leading-relaxed mb-4">{a.description}</p>
                <div className="font-bold text-sm" style={{color:a.priceMonthlyFcfa?"#FF6A00":"#00D4FF"}}>
                  {a.priceMonthlyFcfa?`+ ${formatFcfa(a.priceMonthlyFcfa)} / mois`:"Sur devis"}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="grid md:grid-cols-3 gap-4 mb-20">
          {[
            {q:"Puis-je changer de plan ?",       a:"Oui, à tout moment. Le changement est effectif au cycle suivant sans coupure de service."},
            {q:"Comment se fait l'activation ?",  a:"Immédiatement après paiement Wave confirmé. Votre espace est prêt en moins de 3 minutes."},
            {q:"Que se passe-t-il si je dépasse ?",a:"Vous recevez une alerte avant d'atteindre la limite. La création est bloquée — jamais de surcoût surprise."},
          ].map(f=>(
            <div key={f.q} className="rounded-2xl p-5"
              style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)"}}>
              <div className="font-semibold text-white text-sm mb-2">{f.q}</div>
              <p className="text-white/40 text-xs leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        {/* ── CTA FINAL ── */}
        <div className="text-center rounded-3xl py-14 px-6 relative overflow-hidden"
          style={{background:"linear-gradient(135deg,rgba(255,69,0,.12),rgba(255,215,0,.06))",border:"1px solid rgba(255,69,0,.2)"}}>
          <div className="absolute inset-0 pointer-events-none"
            style={{backgroundImage:"radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px)",backgroundSize:"40px 40px"}} />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{fontFamily:"'Syne',sans-serif"}}>
              Prêt à piloter votre flotte ?
            </h2>
            <p className="text-white/45 mb-8 max-w-lg mx-auto">
              Choisissez votre plan, payez via Wave et accédez à votre espace professionnel en quelques minutes.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/signup"
                className="inline-flex items-center gap-2 rounded-full font-bold px-7 py-4 text-white text-sm"
                style={{background:"linear-gradient(135deg,#FF4500,#FF6A00)",boxShadow:"0 0 30px rgba(255,69,0,.4)"}}>
                Commencer maintenant <ArrowRight size={16} />
              </Link>
              <a href="mailto:contact@vtcdashboard.com"
                className="inline-flex items-center gap-2 rounded-full font-semibold px-7 py-4 text-white text-sm"
                style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)"}}>
                Nous contacter
              </a>
            </div>
          </div>
        </div>

        <div className="mt-14 text-center text-xs text-white/20">
          © {new Date().getFullYear()} VTC Dashboard · Tarifs en FCFA · Paiement Wave · Sans engagement
        </div>
      </div>
    </div>
  )
}
