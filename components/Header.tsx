"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { useTenant } from "@/components/TenantProvider"

export default function Header() {
  const { tenant } = useTenant()
  const name = tenant?.nom || "VTC Dashboard"
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold">
        🚗 {name}
      </h1>

      <ThemeToggle />
    </div>
  )
}