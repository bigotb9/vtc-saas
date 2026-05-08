"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { TRANSLATIONS, type Lang, type TranslationKey } from "@/lib/i18n/translations"

type TFunc = (key: TranslationKey, vars?: Record<string, string | number>) => string

type LangContextType = {
  lang:    Lang
  setLang: (l: Lang) => void
  t:       TFunc
}

const LangContext = createContext<LangContextType | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr")

  useEffect(() => {
    const stored = localStorage.getItem("vtc_lang") as Lang | null
    if (stored === "en" || stored === "fr") setLangState(stored)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem("vtc_lang", l)
  }, [])

  const t: TFunc = useCallback((key, vars) => {
    let str =
      (TRANSLATIONS[lang] as Record<string, string>)[key] ??
      (TRANSLATIONS.fr as Record<string, string>)[key] ??
      key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v))
      }
    }
    return str
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error("useLang must be used within LangProvider")
  return ctx
}

export function useT() {
  return useLang().t
}
