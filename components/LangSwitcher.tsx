"use client"

import { useLang } from "@/lib/i18n/context"

export function LangSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { lang, setLang } = useLang()
  const next = lang === "fr" ? "en" : "fr"
  const label = lang === "fr" ? "FR" : "EN"
  const flag  = lang === "fr" ? "🇫🇷" : "🇬🇧"
  const title = lang === "fr" ? "Switch to English" : "Passer en français"

  return (
    <button
      onClick={() => setLang(next)}
      title={title}
      className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition border border-gray-200 dark:border-white/10 select-none"
    >
      <span>{flag}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  )
}
