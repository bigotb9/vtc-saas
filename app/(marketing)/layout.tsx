import Link from "next/link"
import { Truck } from "lucide-react"

/**
 * Layout marketing — appliqué aux routes /landing, /pricing, /signup.
 * Pas de sidebar, pas de TenantProvider : ces pages sont publiques et
 * doivent fonctionner sans tenant résolu.
 *
 * Sert de squelette commun (header + footer) pour la landing publique
 * vtcdashboard.com.
 */

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0A0F1A] text-gray-900 dark:text-gray-100">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}


function MarketingHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 backdrop-blur-md bg-white/60 dark:bg-transparent border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white">
            <Truck size={18} />
          </span>
          <span className="text-lg">VTC Dashboard</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/landing#features" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600">
            Fonctionnalités
          </Link>
          <Link href="/pricing" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600">
            Tarifs
          </Link>
          <Link href="/landing#contact" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/signup"
            className="hidden md:inline-flex rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition"
          >
            Commencer
          </Link>
        </div>
      </div>
    </header>
  )
}


function MarketingFooter() {
  return (
    <footer className="border-t border-gray-200/60 dark:border-white/5 mt-16">
      <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-6 text-sm">
        <div>
          <div className="flex items-center gap-2 font-semibold mb-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white">
              <Truck size={14} />
            </span>
            VTC Dashboard
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed max-w-xs">
            La plateforme de gestion de flotte VTC pensée pour la Côte d&apos;Ivoire et l&apos;Afrique de l&apos;Ouest.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Produit</h4>
          <ul className="space-y-2 text-gray-500 dark:text-gray-400">
            <li><Link href="/landing#features" className="hover:text-indigo-600">Fonctionnalités</Link></li>
            <li><Link href="/pricing" className="hover:text-indigo-600">Tarifs</Link></li>
            <li><Link href="/signup" className="hover:text-indigo-600">Commencer</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Contact</h4>
          <ul className="space-y-2 text-gray-500 dark:text-gray-400">
            <li>contact@vtcdashboard.com</li>
            <li>Abidjan, Côte d&apos;Ivoire</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200/60 dark:border-white/5 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} VTC Dashboard — Tous droits réservés.
      </div>
    </footer>
  )
}
