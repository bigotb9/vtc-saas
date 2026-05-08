"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import {
  Users, Loader2, CheckCircle2, AlertCircle, Clock,
  RefreshCw, Plus, Download, TrendingUp, TrendingDown,
  Banknote, Wallet, UserCheck, AlertTriangle, Smartphone,
} from "lucide-react"
import type { SaasMetrics, PendingWaveValidation } from "@/lib/saasMetrics"

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1).replace(".0","").replace(".",",")}M`
  if (n >= 1_000)     return `${(n/1_000).toFixed(1).replace(".0","").replace(".",",")}k`
  return n.toLocaleString("fr-FR")
}
function relativeTime(iso: string) {
  const d = Math.round((Date.now()-new Date(iso).getTime())/60000)
  if (d<1) return "à l'instant"
  if (d<60) return `il y a ${d} min`
  return `il y a ${Math.round(d/60)} h`
}

type TRow = { id:string; provisioning_status:string; statut:string }

export default function SaasDashboard() {
  const [metrics, setMetrics] = useState<SaasMetrics|null>(null)
  const [stats,   setStats]   = useState<{total:number;active:number;pending:number;failed:number}|null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data:sess } = await sb.auth.getSession()
    if (!sess.session) return
    const h = { Authorization:`Bearer ${sess.session.access_token}` }
    const [mRes,tRes] = await Promise.all([
      fetch("/api/saas/metrics",{headers:h}),
      fetch("/api/saas/tenants",{headers:h}),
    ])
    if (mRes.ok) setMetrics(await mRes.json())
    if (tRes.ok) {
      const {tenants}=await tRes.json() as {tenants:TRow[]}
      const s={total:0,active:0,pending:0,failed:0}
      for (const t of tenants??[]) {
        s.total++
        if (t.provisioning_status==="ready") s.active++
        else if (t.provisioning_status==="failed") s.failed++
        else if (t.provisioning_status!=="ready") s.pending++
      }
      setStats(s)
    }
    setLoading(false)
  }
  useEffect(()=>{load()},[])

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white" style={{fontFamily:"'Syne',sans-serif"}}>Tour de contrôle</h1>
          <p className="text-sm text-white/35 mt-0.5">
            {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50 transition-all"
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)"}}>
            {loading?<Loader2 size={12} className="animate-spin"/>:<RefreshCw size={12}/>} Actualiser
          </button>
          <a href="/api/saas/tenants/export"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)"}}>
            <Download size={12}/> Export CSV
          </a>
          <Link href="/saas/tenants/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{background:"linear-gradient(135deg,#FF4500,#FF6A00)",color:"#fff",boxShadow:"0 2px 12px rgba(255,69,0,.35)"}}>
            <Plus size={12}/> Nouveau client
          </Link>
        </div>
      </div>

      {/* KPIs tenants */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:"Clients total",  val:stats?.total??0,  icon:Users,        color:"#60a5fa",grad:"from-blue-500 to-cyan-600"},
          {label:"Actifs",         val:stats?.active??0, icon:CheckCircle2, color:"#22c55e",grad:"from-emerald-500 to-teal-600"},
          {label:"En provisioning",val:stats?.pending??0,icon:Clock,        color:"#fbbf24",grad:"from-amber-500 to-orange-600"},
          {label:"Échecs",         val:stats?.failed??0, icon:AlertCircle,  color:"#f87171",grad:"from-red-500 to-rose-600"},
        ].map(k=><KpiCard key={k.label} {...k} loading={loading}/>)}
      </div>

      {/* KPIs business */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics?[
          {label:"RMR",           sublabel:"Revenu Mensuel Récurrent",     val:fmt(metrics.rmr_fcfa)+" F",icon:Banknote,  color:"#22c55e",grad:"from-emerald-500 to-teal-600",trend:null},
          {label:"RAR",           sublabel:"Revenu Annuel Récurrent projeté",val:fmt(metrics.rar_fcfa)+" F",icon:TrendingUp,color:"#fbbf24",grad:"from-amber-500 to-orange-600",trend:null},
          {label:"ARPU",          sublabel:"Revenu moyen / client / mois", val:fmt(metrics.arpu_fcfa)+" F",icon:UserCheck, color:"#a78bfa",grad:"from-violet-500 to-purple-600",trend:null},
          {label:"Encaissé mois", sublabel:"Revenus confirmés ce mois",    val:fmt(metrics.revenue_this_month_fcfa)+" F",icon:Wallet,color:"#FF6A00",grad:"from-orange-500 to-red-600",trend:metrics.revenue_growth_pct},
        ].map(k=><KpiCard key={k.label} {...k} loading={false}/>)
        :Array(4).fill(0).map((_,i)=><KpiCard key={i} label="" sublabel="" val="—" icon={Banknote} color="#60a5fa" grad="from-blue-500 to-cyan-600" loading={true}/>)}
      </div>

      {/* 3 colonnes : plans + alertes + revenus */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Distribution plans */}
        <Panel title="Clients par plan">
          {metrics?(
            <div className="space-y-3">
              {([
                {id:"silver",        label:"Silver",    color:"#94a3b8",n:metrics.customers_by_plan.silver},
                {id:"gold",          label:"Gold",      color:"#FFD700",n:metrics.customers_by_plan.gold},
                {id:"platinum",      label:"Platinum",  color:"#FF4500",n:metrics.customers_by_plan.platinum},
                {id:"platinum_plus", label:"Platinum+", color:"#a855f7",n:metrics.customers_by_plan.platinum_plus},
              ] as const).map(p=>{
                const pct=metrics.active_customers?Math.round(p.n/metrics.active_customers*100):0
                return (
                  <div key={p.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium" style={{color:p.color}}>{p.label}</span>
                      <span className="text-white/40">{p.n} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,.06)"}}>
                      <div className="h-full rounded-full" style={{width:`${pct}%`,background:p.color,opacity:.7}}/>
                    </div>
                  </div>
                )
              })}
              <Row label="Signups ce mois" val={String(metrics.signups_this_month)} />
            </div>
          ):<Spin/>}
        </Panel>

        {/* Alertes */}
        <Panel title="Alertes">
          {metrics?(
            <div className="space-y-2">
              {[
                {n:metrics.pending_wave_validations.length,label:"Paiements Wave à valider",color:"#fbbf24",href:"/saas/paiements",urgent:true},
                {n:metrics.customers_in_arrears,          label:"Abonnements en retard",   color:"#f87171",href:"/saas/paiements"},
                {n:metrics.customers_suspended,           label:"Clients suspendus",        color:"#fb923c",href:"/saas/tenants"},
                {n:metrics.customers_awaiting_payment,    label:"En attente de paiement",  color:"#94a3b8",href:"/saas/tenants"},
              ].map(a=>(
                <Link key={a.label} href={a.href}
                  className="flex items-center justify-between p-2.5 rounded-xl transition-all"
                  style={{background:a.n>0?"rgba(255,255,255,.04)":"transparent",border:`1px solid ${a.n>0&&a.urgent?"rgba(251,191,36,.3)":"rgba(255,255,255,.05)"}`}}>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full" style={{background:a.n>0?a.color:"rgba(255,255,255,.15)"}}/>
                    <span style={{color:a.n>0?"rgba(255,255,255,.75)":"rgba(255,255,255,.3)"}}>{a.label}</span>
                  </div>
                  <span className="text-xs font-bold" style={{color:a.n>0?a.color:"rgba(255,255,255,.2)"}}>{a.n}</span>
                </Link>
              ))}
              <Row label="Churn 30 jours" val={`${metrics.churn_rate_30d}%`} color={metrics.churn_rate_30d>5?"#f87171":"#4ade80"} />
            </div>
          ):<Spin/>}
        </Panel>

        {/* Revenus */}
        <Panel title="Revenus">
          {metrics?(
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-white/30 mb-1">Ce mois</div>
                <div className="text-2xl font-black text-white">{fmt(metrics.revenue_this_month_fcfa)} F</div>
                {metrics.revenue_growth_pct!==null&&(
                  <div className="flex items-center gap-1 text-xs mt-1" style={{color:metrics.revenue_growth_pct>=0?"#4ade80":"#f87171"}}>
                    {metrics.revenue_growth_pct>=0?<TrendingUp size={11}/>:<TrendingDown size={11}/>}
                    {metrics.revenue_growth_pct>0?"+":""}{metrics.revenue_growth_pct}% vs mois dernier
                  </div>
                )}
              </div>
              <div className="pt-3 border-t" style={{borderColor:"rgba(255,255,255,.06)"}}>
                <Row label="Mois précédent" val={fmt(metrics.revenue_last_month_fcfa)+" F"} muted />
              </div>
              <div className="pt-1 space-y-1.5">
                <Row label="RMR actuel"    val={fmt(metrics.rmr_fcfa)+" F"} />
                <Row label="RAR projeté"   val={fmt(metrics.rar_fcfa)+" F"} />
                <Row label="ARPU"          val={fmt(metrics.arpu_fcfa)+" F"} />
              </div>
            </div>
          ):<Spin/>}
        </Panel>
      </div>

      {/* Wave pending */}
      {metrics&&metrics.pending_wave_validations.length>0&&(
        <WavePending items={metrics.pending_wave_validations}/>
      )}
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────── */
function KpiCard({label,sublabel,val,icon:Icon,color,grad,loading,trend}:{
  label:string;sublabel?:string;val:string|number;icon:React.ElementType
  color:string;grad:string;loading:boolean;trend?:number|null
}) {
  return (
    <div className="relative rounded-2xl p-4 overflow-hidden"
      style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)"}}>
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-10"
        style={{background:`linear-gradient(135deg,${color},transparent)`}}/>
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">{label}</p>
          {sublabel&&<p className="text-[9px] text-white/20 mt-0.5">{sublabel}</p>}
          <p className="text-2xl font-black mt-1.5 text-white">
            {loading?<Loader2 size={16} className="animate-spin text-white/30"/>:val}
          </p>
          {trend!==undefined&&trend!==null&&(
            <div className="flex items-center gap-1 text-xs mt-1" style={{color:trend>=0?"#4ade80":"#f87171"}}>
              {trend>=0?<TrendingUp size={10}/>:<TrendingDown size={10}/>}
              {trend>0?"+":""}{trend}%
            </div>
          )}
        </div>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-md shrink-0`}>
          <Icon size={15} className="text-white"/>
        </div>
      </div>
    </div>
  )
}

function Panel({title,children}:{title:string;children:React.ReactNode}) {
  return (
    <div className="rounded-2xl p-5" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)"}}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-white/35 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Row({label,val,color,muted}:{label:string;val:string;color?:string;muted?:boolean}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/35">{label}</span>
      <span className="font-bold" style={{color:color||(muted?"rgba(255,255,255,.4)":"rgba(255,255,255,.8)")}}>{val}</span>
    </div>
  )
}

function Spin() { return <Loader2 className="animate-spin text-white/20 mx-auto" size={20}/> }

function WavePending({items}:{items:PendingWaveValidation[]}) {
  return (
    <div className="rounded-2xl p-5"
      style={{background:"linear-gradient(135deg,rgba(251,191,36,.06),rgba(255,69,0,.04))",border:"1px solid rgba(251,191,36,.25)"}}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:"rgba(251,191,36,.15)"}}>
            <Smartphone size={16} className="text-amber-400"/>
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{items.length} paiement{items.length>1?"s":""} Wave à valider</h3>
            <p className="text-[11px] text-white/40">Vérifier chaque transaction sur Wave Business avant d&apos;activer</p>
          </div>
        </div>
        <span className="w-7 h-7 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.slice(0,5).map(item=>(
          <Link key={item.tenant_id} href={`/saas/tenants/${item.tenant_id}`}
            className="flex items-center gap-3 p-3 rounded-xl transition-all"
            style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)"}}>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-sm truncate">{item.nom}</div>
              <div className="text-xs text-white/35 flex gap-2">
                <span className="font-mono">{item.transaction_ref}</span>
                <span>·</span><span>{relativeTime(item.claimed_at)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-sm text-amber-400">{((item.expected_amount_fcfa)/1000).toLocaleString("fr-FR",{maximumFractionDigits:1})}k F</div>
              <div className="text-[10px] text-white/30">{item.plan_name} · {item.cycle==="yearly"?"annuel":"mensuel"}</div>
            </div>
            <AlertTriangle size={14} className="text-amber-400 shrink-0"/>
          </Link>
        ))}
        {items.length>5&&(
          <Link href="/saas/paiements" className="block text-center text-xs text-amber-400 hover:underline pt-1">
            Voir les {items.length-5} autres →
          </Link>
        )}
      </div>
    </div>
  )
}
