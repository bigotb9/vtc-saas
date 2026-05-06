"use client"

import "./globals.css"
import { Geist, Geist_Mono } from "next/font/google"
import Sidebar from "@/components/Sidebar"
import AuthGuard from "@/components/AuthGuard"
import TenantProvider from "@/components/TenantProvider"
import { ThemeProvider } from "next-themes"
import { SidebarProvider, useSidebar } from "@/lib/SidebarContext"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import PageTransition from "@/components/PageTransition"
import Toaster from "@/components/Toaster"
import MobileNav from "@/components/MobileNav"
import GlobalSearch, { useGlobalSearch } from "@/components/GlobalSearch"
import SupportWidget from "@/components/SupportWidget"

const geist     = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

function SidebarSpacer() {
  const { collapsed } = useSidebar()
  return (
    <div
      className="hidden md:block flex-shrink-0 transition-all duration-300"
      style={{ width: collapsed ? 64 : 256 }}
    />
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch()

  // Écouter l'événement "open-sidebar" du MobileNav bouton "Plus"
  useEffect(() => {
    const handler = () => setSidebarOpen(true)
    window.addEventListener("open-sidebar", handler)
    return () => window.removeEventListener("open-sidebar", handler)
  }, [])

  return (
    <div className="flex">

      {/* SIDEBAR DESKTOP */}
      <SidebarSpacer />

      {/* SIDEBAR MOBILE OVERLAY */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 z-50">
            <Sidebar forceShow />
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div className="flex-1 min-h-screen flex flex-col min-w-0">

        {/* MAIN — padding-bottom sur mobile pour la bottom nav */}
        <main className="flex-1 p-4 pb-24 md:pb-6 md:p-6 bg-gray-50 dark:bg-[#080C14]">
          <PageTransition>{children}</PageTransition>
        </main>

      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

function TenantShell({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <SidebarProvider>
        <AuthGuard>
          <Sidebar />
          <AppShell>{children}</AppShell>
          <MobileNav />
          <Toaster />
          <SupportWidget />
        </AuthGuard>
      </SidebarProvider>
    </TenantProvider>
  )
}

/**
 * Shell ultra-léger pour la page de login tenant ("/").
 * Pas de Sidebar, pas de AuthGuard, pas de AppShell — juste TenantProvider
 * pour que useTenant() renvoie le brand. La page de login (app/page.tsx)
 * a son propre fond plein écran (#060B14), donc pas de flash gris.
 */
function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <Toaster />
      {children}
    </TenantProvider>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const isSaasRoute = pathname.startsWith("/saas")
  // Routes marketing (landing, pricing, signup) — pas de TenantShell, pas
  // d'auth requise. Sont accessibles à tous, y compris depuis un tenant.
  const isMarketingRoute =
    pathname === "/landing" ||
    pathname === "/pricing" ||
    pathname === "/signup" ||
    pathname.startsWith("/landing/") ||
    pathname.startsWith("/pricing/") ||
    pathname.startsWith("/signup/")
  // Routes /dev/* sont des outils de développement (simulation paiement).
  const isDevRoute = pathname.startsWith("/dev/")
  // Routes /pay/* (paiement public d'une facture renewal via lien email).
  const isPayRoute = pathname.startsWith("/pay/")
  // La page de login tenant ("/") doit être plein écran, sans Sidebar ni
  // AppShell — sinon flash gris au chargement (cf. capture du 2026-05-06).
  const isLoginRoute = pathname === "/"
  const skipShells = isSaasRoute || isMarketingRoute || isDevRoute || isPayRoute

  let content: React.ReactNode
  if (skipShells)              content = children
  else if (isLoginRoute)       content = <LoginShell>{children}</LoginShell>
  else                         content = <TenantShell>{children}</TenantShell>

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans bg-gray-50 dark:bg-[#080C14] text-gray-900 dark:text-white`}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          {content}
        </ThemeProvider>
      </body>
    </html>
  )
}
