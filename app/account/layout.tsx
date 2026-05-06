"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Receipt, ShieldCheck, Sparkles, User, Users, Layers } from "lucide-react"

const TABS = [
  { href: "/account",          label: "Aperçu",          icon: User },
  { href: "/account/billing",  label: "Facturation",     icon: Receipt },
  { href: "/account/plan",     label: "Plan",            icon: Layers },
  { href: "/account/team",     label: "Équipe",          icon: Users },
  { href: "/account/addons",   label: "Options",         icon: Sparkles },
  { href: "/account/security", label: "Sécurité",        icon: ShieldCheck },
]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Mon compte</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Gérez votre abonnement, vos factures et votre équipe.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-white/10 mb-6">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/account" && pathname.startsWith(t.href))
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition ${
                active
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-white"
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
