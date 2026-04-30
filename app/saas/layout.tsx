"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Building2, Users, LogOut, LayoutDashboard, Plus } from "lucide-react"
import SaasAdminGuard from "@/components/SaasAdminGuard"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"

export default function SaasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const router   = useRouter()

  // La page /saas/login n'a pas besoin du guard ni du sidebar
  if (pathname === "/saas/login") {
    return <>{children}</>
  }

  const logout = async () => {
    await sb.auth.signOut()
    router.replace("/saas/login")
  }

  const links = [
    { href: "/saas",              label: "Dashboard", icon: LayoutDashboard },
    { href: "/saas/tenants",      label: "Clients",   icon: Users },
    { href: "/saas/tenants/new",  label: "Nouveau client", icon: Plus },
  ]

  return (
    <SaasAdminGuard>
      <div className="flex min-h-screen bg-slate-50 dark:bg-[#080C14]">
        {/* Sidebar SaaS */}
        <aside className="w-60 flex-shrink-0 bg-white dark:bg-[#0D1424] border-r border-gray-100 dark:border-[#1E2D45] p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Building2 size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white leading-none">SaaS</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Tour de contrôle</p>
            </div>
          </div>

          <nav className="space-y-1 flex-1">
            {links.map(l => {
              const active = pathname === l.href || (l.href !== "/saas" && pathname.startsWith(l.href))
              const Icon = l.icon
              return (
                <Link key={l.href} href={l.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}>
                  <Icon size={15} />{l.label}
                </Link>
              )
            })}
          </nav>

          <button onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition">
            <LogOut size={15} />Déconnexion
          </button>
        </aside>

        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </SaasAdminGuard>
  )
}
