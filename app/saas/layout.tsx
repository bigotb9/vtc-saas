"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard, Users, CreditCard, ShieldCheck,
  LogOut, Zap, Bug, ChevronRight,
} from "lucide-react"
import SaasAdminGuard from "@/components/SaasAdminGuard"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"

const NAV = [
  { href: "/saas",           label: "Dashboard",    icon: LayoutDashboard, exact: true },
  { href: "/saas/tenants",   label: "Clients",      icon: Users },
  { href: "/saas/paiements", label: "Paiements",    icon: CreditCard },
  { href: "/saas/admins",    label: "Admins SaaS",  icon: ShieldCheck },
  { href: "/saas/debug",     label: "Debug",        icon: Bug },
]

export default function SaasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const router   = useRouter()
  const [adminEmail, setAdminEmail] = useState<string | null>(null)

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => setAdminEmail(data.user?.email ?? null))
  }, [])

  if (pathname === "/saas/login") return <>{children}</>

  const logout = async () => {
    await sb.auth.signOut()
    router.replace("/saas/login")
  }

  return (
    <SaasAdminGuard>
      <div className="flex min-h-screen" style={{ background: "#030810" }}>

        {/* ── Sidebar ── */}
        <aside className="w-56 flex-shrink-0 flex flex-col border-r"
          style={{ background: "rgba(255,255,255,.025)", borderColor: "rgba(255,255,255,.06)" }}>

          {/* Brand */}
          <div className="px-4 py-5 border-b" style={{ borderColor: "rgba(255,255,255,.06)" }}>
            <Link href="/saas" className="flex items-center gap-2.5">
              <div style={{ width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#FF4500,#FF6A00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 2px 10px rgba(255,69,0,.4)" }}>⚡</div>
              <div>
                <div className="text-white font-black text-sm leading-none">Tour de contrôle</div>
                <div className="text-[10px] mt-0.5" style={{ color:"rgba(255,255,255,.35)" }}>VTC Dashboard Admin</div>
              </div>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV.map(l => {
              const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
              const Icon = l.icon
              return (
                <Link key={l.href} href={l.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group"
                  style={{
                    background: active ? "rgba(255,69,0,.12)" : "transparent",
                    color: active ? "#FF8C55" : "rgba(255,255,255,.45)",
                    border: active ? "1px solid rgba(255,69,0,.22)" : "1px solid transparent",
                  }}>
                  <div className="flex items-center gap-2.5">
                    <Icon size={15} />
                    {l.label}
                  </div>
                  {active && <ChevronRight size={12} style={{ color:"rgba(255,69,0,.6)" }} />}
                </Link>
              )
            })}
          </nav>

          {/* User + logout */}
          <div className="px-3 py-4 border-t" style={{ borderColor:"rgba(255,255,255,.06)" }}>
            {adminEmail && (
              <div className="px-3 py-2 mb-2 rounded-xl" style={{ background:"rgba(255,255,255,.04)" }}>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Connecté</div>
                <div className="text-xs text-white/70 truncate">{adminEmail}</div>
              </div>
            )}
            <button onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ color:"rgba(255,255,255,.35)" }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,.1)"
                ;(e.currentTarget as HTMLElement).style.color = "#f87171"
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background = "transparent"
                ;(e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.35)"
              }}>
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        </aside>

        {/* ── Content ── */}
        <main className="flex-1 overflow-x-auto" style={{ color:"#fff" }}>
          {children}
        </main>
      </div>
    </SaasAdminGuard>
  )
}
