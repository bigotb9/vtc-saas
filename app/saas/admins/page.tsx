"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, ShieldCheck, Trash2, Key, AlertCircle, CheckCircle2 } from "lucide-react"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"

type Admin = {
  id:         string
  email:      string
  nom:        string | null
  role:       "superadmin" | "admin" | "support"
  created_at: string
}

const ROLE_LABELS = { superadmin:"Super Admin", admin:"Admin", support:"Support" }
const ROLE_COLORS = { superadmin:"#FF4500", admin:"#fbbf24", support:"#60a5fa" }

export default function AdminsPage() {
  const [admins, setAdmins]     = useState<Admin[]|null>(null)
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState({ email:"", nom:"", role:"admin" as Admin["role"] })
  const [acting, setActing]     = useState<string|null>(null)
  const [msg, setMsg]           = useState<{ok:boolean;text:string}|null>(null)
  const [myId, setMyId]         = useState<string|null>(null)

  const load = async () => {
    setLoading(true)
    const { data:sess } = await sb.auth.getSession()
    if (!sess.session) return
    setMyId(sess.session.user.id)
    const res = await fetch("/api/saas/admins", {
      headers: { Authorization:`Bearer ${sess.session.access_token}` }
    })
    if (res.ok) setAdmins((await res.json()).admins)
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const getToken = async () => {
    const { data:sess } = await sb.auth.getSession()
    return sess.session?.access_token ?? ""
  }

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null)
    setActing("adding")
    try {
      const r = await fetch("/api/saas/admins", {
        method:"POST", headers:{ Authorization:`Bearer ${await getToken()}`, "Content-Type":"application/json" },
        body: JSON.stringify(form)
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setMsg({ok:true, text:`Admin ${form.email} créé avec succès.`})
      setForm({email:"",nom:"",role:"admin"})
      setAdding(false)
      load()
    } catch(e) { setMsg({ok:false,text:(e as Error).message}) }
    finally { setActing(null) }
  }

  const changeRole = async (id:string, role:Admin["role"]) => {
    setActing(id)
    const r = await fetch(`/api/saas/admins/${id}`, {
      method:"PATCH", headers:{ Authorization:`Bearer ${await getToken()}`, "Content-Type":"application/json" },
      body: JSON.stringify({role})
    })
    if (r.ok) load()
    setActing(null)
  }

  const resetPassword = async (email:string) => {
    setActing("reset-"+email)
    try {
      const r = await fetch("/api/saas/admins/reset-password", {
        method:"POST", headers:{ Authorization:`Bearer ${await getToken()}`, "Content-Type":"application/json" },
        body: JSON.stringify({email})
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setMsg({ok:true, text:`Email de réinitialisation envoyé à ${email}`})
    } catch(e) { setMsg({ok:false,text:(e as Error).message}) }
    finally { setActing(null) }
  }

  const removeAdmin = async (id:string, email:string) => {
    if (!confirm(`Retirer ${email} des admins SaaS ?`)) return
    setActing(id)
    const r = await fetch(`/api/saas/admins/${id}`, {
      method:"DELETE", headers:{ Authorization:`Bearer ${await getToken()}` }
    })
    if (r.ok) load()
    setActing(null)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white" style={{fontFamily:"'Syne',sans-serif"}}>Admins SaaS</h1>
          <p className="text-sm text-white/35 mt-0.5">Gérez les accès à la tour de contrôle</p>
        </div>
        <button onClick={()=>{setAdding(p=>!p);setMsg(null)}}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
          style={{background:"linear-gradient(135deg,#FF4500,#FF6A00)",color:"#fff"}}>
          <Plus size={14}/> Ajouter un admin
        </button>
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`flex items-start gap-2 p-4 rounded-xl text-sm ${msg.ok?"text-emerald-400":"text-red-400"}`}
          style={{background:msg.ok?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",border:`1px solid ${msg.ok?"rgba(34,197,94,.25)":"rgba(239,68,68,.25)"}`}}>
          {msg.ok?<CheckCircle2 size={16} className="mt-0.5 shrink-0"/>:<AlertCircle size={16} className="mt-0.5 shrink-0"/>}
          {msg.text}
        </div>
      )}

      {/* Formulaire ajout */}
      {adding && (
        <form onSubmit={addAdmin} className="rounded-2xl p-5 space-y-3"
          style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)"}}>
          <h3 className="font-semibold text-white text-sm">Nouvel admin</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1">Email *</label>
              <input type="email" required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                placeholder="admin@email.com" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Nom</label>
              <input type="text" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
                placeholder="Prénom Nom" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Rôle *</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as Admin["role"]}))} className={inp}>
                <option value="support">Support</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-white/35">
            Un email d&apos;invitation sera envoyé. L&apos;admin devra définir son mot de passe via le lien reçu.
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={acting==="adding"}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
              style={{background:"rgba(255,69,0,.2)",color:"#FF8C55",border:"1px solid rgba(255,69,0,.3)"}}>
              {acting==="adding"?<Loader2 size={13} className="animate-spin"/>:<Plus size={13}/>}
              Créer l&apos;admin
            </button>
            <button type="button" onClick={()=>setAdding(false)}
              className="px-4 py-2 text-sm font-medium rounded-full text-white/40 hover:text-white/70 transition">
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Liste admins */}
      {loading ? <Loader2 className="animate-spin text-white/30 mx-auto" size={20}/> : (
        <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,.07)"}}>
          <div className="p-4 text-[10px] font-bold uppercase tracking-wider text-white/25"
            style={{background:"rgba(255,255,255,.03)",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
            {admins?.length ?? 0} admin{(admins?.length??0)>1?"s":""} SaaS
          </div>
          {(admins??[]).map(a=>(
            <div key={a.id} className="flex items-center gap-4 p-4 border-t"
              style={{borderColor:"rgba(255,255,255,.06)"}}>
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                style={{background:`${ROLE_COLORS[a.role]}22`,color:ROLE_COLORS[a.role]}}>
                <ShieldCheck size={16}/>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm truncate">{a.nom || a.email}</div>
                <div className="text-xs text-white/35 truncate">{a.email}</div>
              </div>
              {/* Role */}
              {a.id===myId ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{background:`${ROLE_COLORS[a.role]}22`,color:ROLE_COLORS[a.role]}}>
                  {ROLE_LABELS[a.role]} (moi)
                </span>
              ) : (
                <select value={a.role}
                  onChange={e=>changeRole(a.id,e.target.value as Admin["role"])}
                  disabled={acting===a.id}
                  className="text-xs rounded-full px-3 py-1.5 font-bold transition-all"
                  style={{background:`${ROLE_COLORS[a.role]}15`,color:ROLE_COLORS[a.role],border:`1px solid ${ROLE_COLORS[a.role]}33`,cursor:"pointer"}}>
                  <option value="support">Support</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              )}
              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button title="Reset mot de passe" onClick={()=>resetPassword(a.email)}
                  disabled={acting==="reset-"+a.email}
                  className="p-2 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-400/10 transition-all">
                  {acting==="reset-"+a.email?<Loader2 size={14} className="animate-spin"/>:<Key size={14}/>}
                </button>
                {a.id!==myId && (
                  <button title="Retirer cet admin" onClick={()=>removeAdmin(a.id,a.email)}
                    disabled={acting===a.id}
                    className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    {acting===a.id?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guide rôles */}
      <div className="rounded-2xl p-5 space-y-3" style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)"}}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/35">Définition des rôles</h3>
        {[
          {role:"superadmin",desc:"Accès complet. Peut gérer les admins, valider paiements, modifier tout tenant."},
          {role:"admin",     desc:"Accès complet sauf gestion des admins SaaS."},
          {role:"support",   desc:"Lecture + validation de paiements Wave. Pas de suppression ni de modification critique."},
        ].map(r=>(
          <div key={r.role} className="flex items-start gap-3">
            <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
              style={{background:`${ROLE_COLORS[r.role as Admin["role"]]}15`,color:ROLE_COLORS[r.role as Admin["role"]]}}>
              {ROLE_LABELS[r.role as Admin["role"]]}
            </span>
            <span className="text-xs text-white/40 leading-relaxed">{r.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const inp = "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
