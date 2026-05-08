"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, AlertTriangle, Clock, CheckCircle2, RefreshCw, CreditCard, Smartphone, XCircle } from "lucide-react"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import type { SaasMetrics, PendingWaveValidation, PastDueTenant } from "@/lib/saasMetrics"

function fmt(n:number){
  if(n>=1_000_000) return `${(n/1_000_000).toFixed(1).replace(".0","").replace(".",",")}M`
  if(n>=1_000) return `${(n/1_000).toFixed(1).replace(".0","").replace(".",",")}k`
  return n.toLocaleString("fr-FR")
}

type Tab = "wave" | "retard" | "echecs"

export default function PaiementsPage() {
  const [tab, setTab]         = useState<Tab>("wave")
  const [metrics, setMetrics] = useState<SaasMetrics|null>(null)
  const [failures, setFailures] = useState<FailedAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState<string|null>(null)

  const load = async () => {
    setLoading(true)
    const {data:sess}=await sb.auth.getSession()
    if(!sess.session) return
    const h={Authorization:`Bearer ${sess.session.access_token}`}
    const [mRes,fRes]=await Promise.all([
      fetch("/api/saas/metrics",{headers:h}),
      fetch("/api/saas/paiements/echecs",{headers:h}),
    ])
    if(mRes.ok) setMetrics(await mRes.json())
    if(fRes.ok) setFailures((await fRes.json()).attempts??[])
    setLoading(false)
  }
  useEffect(()=>{load()},[])

  const confirm = async (tenantId:string) => {
    setActing(tenantId)
    const {data:sess}=await sb.auth.getSession()
    if(!sess.session){setActing(null);return}
    await fetch(`/api/signup/${tenantId}/confirm-payment`,{
      method:"POST",headers:{Authorization:`Bearer ${sess.session.access_token}`}
    })
    setActing(null); load()
  }

  const TABS: {id:Tab;label:string;count?:number;icon:React.ElementType}[] = [
    {id:"wave",    label:"Paiements Wave",    count:metrics?.pending_wave_validations.length, icon:Smartphone},
    {id:"retard",  label:"En retard",          count:metrics?.customers_in_arrears,           icon:Clock},
    {id:"echecs",  label:"Échecs paiement",    count:failures.length,                         icon:XCircle},
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white" style={{fontFamily:"'Syne',sans-serif"}}>Paiements & Renouvellements</h1>
          <p className="text-sm text-white/35 mt-0.5">Suivi des paiements en attente, retards et échecs</p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50"
          style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)"}}>
          {loading?<Loader2 size={12} className="animate-spin"/>:<RefreshCw size={12}/>} Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background:tab===t.id?"rgba(255,255,255,.1)":"transparent",
              color:tab===t.id?"#fff":"rgba(255,255,255,.4)",
            }}>
            <t.icon size={13}/>
            {t.label}
            {(t.count??0)>0&&(
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-black"
                style={{background:tab===t.id?"rgba(255,69,0,.3)":"rgba(255,255,255,.1)",color:tab===t.id?"#FF8C55":"rgba(255,255,255,.5)"}}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-white/30" size={24}/></div> : (
        <>
          {/* Onglet Wave pending */}
          {tab==="wave"&&(
            <WaveTab items={metrics?.pending_wave_validations??[]} acting={acting} onConfirm={confirm}/>
          )}
          {/* Onglet Retard */}
          {tab==="retard"&&(
            <RetardTab tenants={metrics?.past_due_tenants??[]}/>
          )}
          {/* Onglet Échecs */}
          {tab==="echecs"&&(
            <EchecsTab attempts={failures}/>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Tab Wave ──────────────────────────────────────────────── */
function WaveTab({items,acting,onConfirm}:{items:PendingWaveValidation[];acting:string|null;onConfirm:(id:string)=>void}) {
  if(items.length===0) return (
    <Empty icon={Smartphone} title="Aucun paiement Wave en attente" color="#22c55e"/>
  )
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">{items.length} déclaration{items.length>1?"s":""} à vérifier sur Wave Business puis activer.</p>
      {items.map(item=>(
        <div key={item.tenant_id} className="rounded-2xl p-5"
          style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(251,191,36,.2)"}}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-bold text-white mb-1">{item.nom}</div>
              <div className="text-xs text-white/40 space-y-0.5">
                <div>📧 {item.email_admin}</div>
                <div>💳 Plan : <span className="text-white/60 font-medium">{item.plan_name} · {item.cycle==="yearly"?"annuel":"mensuel"}</span></div>
                <div>💰 Montant attendu : <span className="text-amber-400 font-bold">{fmt(item.expected_amount_fcfa)} FCFA</span></div>
              </div>
            </div>
            <div className="rounded-xl p-3" style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)"}}>
              <div className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-1">N° transaction Wave</div>
              <div className="font-mono font-bold text-amber-300">{item.transaction_ref}</div>
              {item.payer_phone&&<div className="text-[10px] text-amber-400/60 mt-0.5">Tél: {item.payer_phone}</div>}
              <div className="text-[10px] text-white/30 mt-0.5">Déclaré {new Date(item.claimed_at).toLocaleString("fr-FR")}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4" style={{borderTop:"1px solid rgba(255,255,255,.06)"}}>
            <Link href={`/saas/tenants/${item.tenant_id}`}
              className="text-xs text-white/50 hover:text-white transition underline">
              Voir la fiche tenant →
            </Link>
            <div className="flex-1"/>
            <button onClick={()=>onConfirm(item.tenant_id)} disabled={acting===item.tenant_id}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all"
              style={{background:"rgba(34,197,94,.15)",color:"#4ade80",border:"1px solid rgba(34,197,94,.3)"}}>
              {acting===item.tenant_id?<Loader2 size={13} className="animate-spin"/>:<CheckCircle2 size={13}/>}
              Vérifiée — Activer le compte
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Tab Retard ────────────────────────────────────────────── */
function RetardTab({tenants}:{tenants:PastDueTenant[]}) {
  if(tenants.length===0) return (
    <Empty icon={Clock} title="Aucun abonnement en retard" color="#22c55e"/>
  )
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        Ces clients ont dépassé leur date d&apos;échéance. Ils seront suspendus automatiquement au bout de 7 jours.
      </p>
      {tenants.map(t=>(
        <div key={t.tenant_id} className="rounded-2xl p-4 flex items-center gap-4 flex-wrap"
          style={{background:"rgba(255,255,255,.03)",border:`1px solid ${t.days_overdue>7?"rgba(239,68,68,.3)":"rgba(251,191,36,.2)"}`}}>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">{t.nom}</div>
            <div className="text-xs text-white/40">{t.email_admin} · Plan {t.plan_id}</div>
          </div>
          <div className="text-center">
            <div className="font-bold" style={{color:t.days_overdue>7?"#f87171":"#fbbf24"}}>{t.days_overdue}j</div>
            <div className="text-[10px] text-white/30">de retard</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-white">{fmt(t.amount_fcfa)} F</div>
            <div className="text-[10px] text-white/30">
              Échu le {new Date(t.current_period_end).toLocaleDateString("fr-FR")}
            </div>
          </div>
          <Link href={`/saas/tenants/${t.tenant_id}`}
            className="text-xs rounded-full px-3 py-1.5 font-medium transition-all"
            style={{background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.1)"}}>
            Gérer →
          </Link>
        </div>
      ))}
    </div>
  )
}

/* ─── Tab Échecs ─────────────────────────────────────────────── */
type FailedAttempt = {
  id:string; invoice_id:string; attempted_at:string
  amount_fcfa:number; provider:string; error_message:string|null
  tenant_id?:string; tenant_nom?:string
}
function EchecsTab({attempts}:{attempts:FailedAttempt[]}) {
  if(attempts.length===0) return (
    <Empty icon={XCircle} title="Aucun échec de paiement récent" color="#22c55e"/>
  )
  return (
    <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,.07)"}}>
      <table className="w-full text-sm">
        <thead style={{background:"rgba(255,255,255,.04)",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <tr className="text-[10px] uppercase tracking-wider text-white/30">
            {["Client","Date","Montant","Provider","Erreur",""].map(h=>(
              <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attempts.map(a=>(
            <tr key={a.id} className="border-t" style={{borderColor:"rgba(255,255,255,.05)"}}>
              <td className="px-4 py-3 text-white/80">{a.tenant_nom||"—"}</td>
              <td className="px-4 py-3 text-white/40 text-xs">{new Date(a.attempted_at).toLocaleDateString("fr-FR")}</td>
              <td className="px-4 py-3 font-bold text-red-400">{fmt(a.amount_fcfa)} F</td>
              <td className="px-4 py-3">
                <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.5)"}}>{a.provider}</span>
              </td>
              <td className="px-4 py-3 text-xs text-red-400 max-w-xs truncate">{a.error_message||"—"}</td>
              <td className="px-4 py-3">
                {a.tenant_id&&(
                  <Link href={`/saas/tenants/${a.tenant_id}`} className="text-xs text-white/40 hover:text-white transition">Voir →</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({icon:Icon,title,color}:{icon:React.ElementType;title:string;color:string}) {
  return (
    <div className="text-center py-16">
      <Icon size={32} className="mx-auto mb-3" style={{color:"rgba(255,255,255,.15)"}}/>
      <p className="text-white/40 text-sm">{title}</p>
      <div className="w-2 h-2 rounded-full mx-auto mt-3 animate-pulse" style={{background:color}}/>
    </div>
  )
}
