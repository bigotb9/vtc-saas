"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle, AlertTriangle, CheckCircle2, Loader2, Mail, Plus,
  ShieldCheck, Trash2, UserCog, X,
} from "lucide-react"
import { authFetch } from "@/lib/authFetch"

type Member = {
  id:              string
  email:           string | null
  role:            string
  avatar_url:      string | null
  created_at:      string
  last_sign_in_at: string | null
  email_confirmed: boolean
}

type Quota = { ok: boolean; current: number; limit: number | null; remaining: number | null }

const ROLE_LABELS: Record<string, string> = {
  directeur:   "Administrateur",
  dispatcher:  "Dispatcher",
  comptable:   "Comptable",
  lecture:     "Lecture seule",
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  async function refresh() {
    try {
      const r = await authFetch("/api/account/team")
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setMembers(j.members)
      setQuota(j.quota)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => { refresh() }, [])

  if (members === null && !error) return <Loader2 className="animate-spin text-indigo-500" />

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header avec quota + invite */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {quota
              ? quota.limit === null
                ? `${quota.current} membre${quota.current > 1 ? "s" : ""} (illimité)`
                : `${quota.current} / ${quota.limit} membre${quota.limit > 1 ? "s" : ""}`
              : "—"
            }
          </p>
          {quota && quota.limit !== null && quota.remaining !== null && quota.remaining === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 inline-flex items-center gap-1">
              <AlertTriangle size={12} />
              Quota atteint — passez à un plan supérieur pour inviter plus de membres.
            </p>
          )}
        </div>
        <button
          onClick={() => setShowInvite(true)}
          disabled={quota && !quota.ok ? true : false}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2"
        >
          <Plus size={14} />
          Inviter un membre
        </button>
      </div>

      {/* Liste */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] divide-y divide-gray-100 dark:divide-white/5">
        {(members ?? []).length === 0 && (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Aucun membre dans votre équipe.
          </div>
        )}
        {(members ?? []).map((m) => (
          <MemberRow key={m.id} member={m} onChange={refresh} />
        ))}
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); refresh() }}
        />
      )}
    </div>
  )
}


function MemberRow({ member, onChange }: { member: Member; onChange: () => void }) {
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState(member.role)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function changeRole(newRole: string) {
    setSaving(true)
    setError(null)
    try {
      const r = await authFetch(`/api/account/team/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setRole(newRole)
      setEditing(false)
      onChange()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteMember() {
    setSaving(true)
    setError(null)
    try {
      const r = await authFetch(`/api/account/team/${member.id}`, { method: "DELETE" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      onChange()
    } catch (e) {
      setError((e as Error).message)
      setConfirmDelete(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {(member.email || "?").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{member.email || "(email manquant)"}</span>
          {!member.email_confirmed && (
            <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded">
              En attente
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {member.last_sign_in_at
            ? `Connexion : ${formatRelative(member.last_sign_in_at)}`
            : "Jamais connecté"}
        </div>
        {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
      </div>

      {editing ? (
        <div className="flex items-center gap-1">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1"
          >
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={() => changeRole(role)}
            disabled={saving}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-xs"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
          </button>
          <button
            onClick={() => { setEditing(false); setRole(member.role) }}
            className="rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1 text-xs"
          >
            <X size={14} />
          </button>
        </div>
      ) : confirmDelete ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-red-600 mr-2">Supprimer ?</span>
          <button onClick={deleteMember} disabled={saving} className="rounded-lg bg-red-600 text-white px-2 py-1 text-xs">
            {saving ? <Loader2 size={12} className="animate-spin" /> : "Confirmer"}
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 px-2">Annuler</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 inline-flex items-center gap-1">
            {member.role === "directeur" && <ShieldCheck size={12} />}
            {ROLE_LABELS[member.role] || member.role}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            title="Changer le rôle"
          >
            <UserCog size={14} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-400 hover:text-red-600 p-1"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}


function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("dispatcher")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const r = await authFetch("/api/account/team", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      onInvited()
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0D1424] shadow-2xl p-6 space-y-4"
      >
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2"><Mail size={16} /> Inviter un membre</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Un email avec un lien d&apos;activation lui sera envoyé.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="membre@entreprise.com"
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Rôle</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
          >
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 dark:border-white/10 px-4 py-2 text-sm">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !email}
            className="rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium inline-flex items-center gap-1"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Envoyer l&apos;invitation
          </button>
        </div>
      </form>
    </div>
  )
}


function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1)   return "à l'instant"
  if (minutes < 60)  return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24)    return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30)     return `il y a ${days} j`
  return new Date(iso).toLocaleDateString("fr-FR")
}
