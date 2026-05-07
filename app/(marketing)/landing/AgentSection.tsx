"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

/* ─── Messages de la conversation ─────────────────────────────────── */
type Msg = { role: "user" | "bot"; text: string }

const CONV: Msg[] = [
  {
    role: "user",
    text: "Bonjour ! Liste-moi mes véhicules avec les chauffeurs assignés 🙏",
  },
  {
    role: "bot",
    text: "Bonjour ! Voici votre flotte active 🚗\n\n▸ AB-1234-CI · Toyota Corolla\n  👤 Kouamé Assi · En service ✅\n\n▸ AC-5678-CI · Hyundai i20\n  👤 Bamba Ouattara · En service ✅\n\n▸ BD-9012-CI · Kia Picanto\n  👤 Konan Koffi · Maintenance ⚠️\n\n▸ AB-3456-CI · Toyota Yaris\n  👤 Yapi Adjobi · En service ✅\n\n▸ CD-7890-CI · Hyundai Accent\n  👤 Traoré Moussa · En service ✅\n\n5 véhicules · 4 actifs aujourd'hui",
  },
  {
    role: "user",
    text: "Parfait. Fais-moi le point des recettes de cette semaine",
  },
  {
    role: "bot",
    text: "📊 Recettes — semaine en cours\n\nKouamé Assi ........... 127 500 F\nBamba Ouattara ....... 98 000 F\nKonan Koffi .............. 43 200 F\nYapi Adjobi .............. 115 800 F\nTraoré Moussa ......... 109 600 F\n─────────────────────\n💰 Total : 494 100 FCFA\n📈 +12 % vs semaine passée\n\n💡 Konan a moins travaillé (maintenance). Récupération attendue en fin de semaine.",
  },
  {
    role: "user",
    text: "Des alertes importantes à me signaler ?",
  },
  {
    role: "bot",
    text: "🚨 3 alertes actives\n\n⚠️ Assurance expire dans 4 jours\n    → BD-9012-CI (Konan Koffi)\n\n📵 Aucune recette depuis hier\n    → CD-7890-CI (Traoré Moussa)\n\n💸 Versement client en retard\n    → Propriétaire Coulibaly\n    75 000 FCFA · en souffrance 6j\n\nJe recommande de contacter Traoré et relancer M. Coulibaly aujourd'hui.",
  },
]

/* timings en ms : [user_appears, bot_typing, bot_appears] × messages */
const STEPS = [
  { user: 1000, typing: 1400, bot: 3200 },
  { user: 1800, typing: 2200, bot: 3600 },
  { user: 1500, typing: 2000, bot: 3200 },
]

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/* ─── Bénéfices ───────────────────────────────────────────────────── */
const BENEFITS = [
  {
    icon: "🔍",
    color: "#4f46e5",
    title: "Requêtes en langage naturel",
    text: "Posez n'importe quelle question en français sur Telegram. L'agent interroge votre base en temps réel et répond instantanément.",
  },
  {
    icon: "📊",
    color: "#0891b2",
    title: "Rapports à la demande, 24h/24",
    text: "Recettes, dépenses, top chauffeurs, bilan mensuel — obtenez tout en une phrase sans ouvrir le dashboard.",
  },
  {
    icon: "🚨",
    color: "#dc2626",
    title: "Alertes proactives intelligentes",
    text: "Assurances, chauffeurs inactifs, paiements en retard — l'agent surveille et vous alerte avant que le problème s'aggrave.",
  },
  {
    icon: "💡",
    color: "#d97706",
    title: "Recommandations business concrètes",
    text: "Pas juste des données : l'agent analyse les tendances et vous propose des actions immédiates pour maximiser votre CA.",
  },
  {
    icon: "🔒",
    color: "#059669",
    title: "Agent dédié, données privées",
    text: "Votre agent est branché uniquement sur votre base de données privée et isolée. Aucun partage, confidentialité totale.",
  },
]

/* ─── Composant principal ─────────────────────────────────────────── */
export default function AgentSection() {
  const [visible, setVisible] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  /* scroll vers le bas à chaque nouveau message */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }
  }, [visible, typing])

  /* boucle de conversation infinie */
  useEffect(() => {
    let active = true
    async function run() {
      while (active) {
        setVisible([])
        setTyping(false)
        await sleep(1800)
        if (!active) return

        for (let i = 0; i < CONV.length; i += 2) {
          const step = STEPS[i / 2] ?? STEPS[STEPS.length - 1]

          /* message user */
          if (!active) return
          setVisible(v => [...v, CONV[i]])
          await sleep(step.user)

          /* indicateur frappe */
          if (!active) return
          setTyping(true)
          await sleep(step.typing)

          /* réponse bot */
          if (!active) return
          setTyping(false)
          setVisible(v => [...v, CONV[i + 1]])
          await sleep(step.bot)
        }
        await sleep(5000)
      }
    }
    run()
    return () => { active = false }
  }, [])

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <span
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-5"
            style={{ background: "rgba(79,70,229,.1)", color: "#4f46e5", border: "1px solid rgba(79,70,229,.25)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            Disponible en option · Plans Gold & Platinum
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Intègre un agent IA personnalisé<br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              à ton business
            </span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
            Un assistant IA branché directement sur votre base de données qui répond
            à toutes vos questions sur Telegram — en français, en temps réel, 24h/24.
          </p>
        </div>

        {/* Layout 2 colonnes */}
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* ── Bénéfices ── */}
          <div className="space-y-4">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex gap-4 items-start rounded-2xl border border-gray-100 p-5 hover:border-indigo-100 hover:shadow-md transition-all"
                style={{ background: "#fafafa" }}
              >
                <div
                  className="flex items-center justify-center text-xl rounded-xl w-11 h-11 shrink-0"
                  style={{ background: `${b.color}15` }}
                >
                  {b.icon}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm mb-1">{b.title}</div>
                  <div className="text-gray-500 text-xs leading-relaxed">{b.text}</div>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <Link
                href="/signup?plan=gold"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 transition shadow-lg shadow-indigo-600/20"
              >
                Activer l&apos;Agent IA
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
          </div>

          {/* ── Smartphone premium ── */}
          <div className="flex justify-center items-center">
            {/* Glow derrière le téléphone */}
            <div className="relative">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse 60% 60% at 50% 55%, rgba(99,102,241,.18) 0%, transparent 70%)",
                  filter: "blur(28px)",
                  transform: "scale(1.3)",
                }}
              />

              {/* Chassis téléphone */}
              <div
                style={{
                  position: "relative",
                  width: 290,
                  height: 590,
                  borderRadius: 52,
                  /* cadre gradient titanium */
                  background: "linear-gradient(160deg,#38383a 0%,#1c1c1e 60%,#2c2c2e 100%)",
                  padding: 3,
                  boxShadow: [
                    "0 60px 120px rgba(0,0,0,.22)",
                    "0 20px 40px rgba(0,0,0,.18)",
                    "0 0 0 1px rgba(255,255,255,.06)",
                    "inset 0 1px 0 rgba(255,255,255,.12)",
                  ].join(","),
                }}
              >
                {/* Bouton action & volumes (gauche) */}
                {[{ top: 140, h: 32 }, { top: 188, h: 60 }, { top: 258, h: 60 }].map((b, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute", left: -5, top: b.top,
                      width: 5, height: b.h,
                      background: "linear-gradient(180deg,#3a3a3c,#2c2c2e)",
                      borderRadius: "4px 0 0 4px",
                    }}
                  />
                ))}
                {/* Bouton power (droite) */}
                <div
                  style={{
                    position: "absolute", right: -5, top: 190,
                    width: 5, height: 70,
                    background: "linear-gradient(180deg,#3a3a3c,#2c2c2e)",
                    borderRadius: "0 4px 4px 0",
                  }}
                />

                {/* Écran */}
                <div
                  style={{
                    width: "100%", height: "100%",
                    borderRadius: 50,
                    background: "#000",
                    overflow: "hidden",
                    display: "flex", flexDirection: "column",
                  }}
                >
                  {/* Dynamic Island */}
                  <div
                    style={{
                      position: "absolute",
                      top: 14, left: "50%", transform: "translateX(-50%)",
                      width: 126, height: 35,
                      background: "#000",
                      borderRadius: 20, zIndex: 20,
                      display: "flex", alignItems: "center", justifyContent: "space-around",
                      padding: "0 20px",
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1a1a1a", border: "1.5px solid #2a2a2a" }} />
                    <div style={{ width: 28, height: 7, borderRadius: 4, background: "#1a1a1a", border: "1.5px solid #2a2a2a" }} />
                  </div>

                  {/* Status bar */}
                  <div
                    style={{
                      flexShrink: 0, paddingTop: 16, paddingLeft: 20, paddingRight: 16, paddingBottom: 6,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "linear-gradient(180deg,#17153b,#1a1535)",
                    }}
                  >
                    <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>9:41</span>
                    <span style={{ color: "#fff", fontSize: 9 }}>●●● 5G ▐▐▐</span>
                  </div>

                  {/* Header Telegram */}
                  <div
                    style={{
                      flexShrink: 0,
                      background: "linear-gradient(135deg,#17153b,#1e1b4b)",
                      padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: 10,
                      borderBottom: "1px solid rgba(255,255,255,.06)",
                    }}
                  >
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 17, fontWeight: 700,
                        boxShadow: "0 2px 8px rgba(99,102,241,.5)",
                      }}
                    >🤖</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: "-.01em" }}>VTC Agent IA</div>
                      <div style={{ color: "#22c55e", fontSize: 10, fontWeight: 600 }}>● en ligne</div>
                    </div>
                    <div style={{ color: "rgba(255,255,255,.4)", fontSize: 18 }}>⋮</div>
                  </div>

                  {/* Zone messages */}
                  <div
                    ref={scrollRef}
                    style={{
                      flex: 1,
                      background: "linear-gradient(180deg,#0d0c1e,#0a091b)",
                      overflowY: "auto",
                      padding: "12px 10px",
                      display: "flex", flexDirection: "column", gap: 8,
                      scrollbarWidth: "none",
                    }}
                  >
                    {visible.map((msg, i) => (
                      <ChatBubble key={i} msg={msg} />
                    ))}
                    {typing && <TypingIndicator />}
                  </div>

                  {/* Input factice */}
                  <div
                    style={{
                      flexShrink: 0,
                      background: "#17153b",
                      borderTop: "1px solid rgba(255,255,255,.06)",
                      padding: "8px 10px",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <div
                      style={{
                        flex: 1, background: "rgba(255,255,255,.06)",
                        borderRadius: 999, padding: "7px 12px",
                        color: "rgba(255,255,255,.28)", fontSize: 12,
                      }}
                    >Message…</div>
                    <div
                      style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, boxShadow: "0 2px 8px rgba(99,102,241,.4)",
                      }}
                    >↑</div>
                  </div>

                  {/* Home indicator */}
                  <div
                    style={{
                      flexShrink: 0, background: "#0a091b",
                      padding: "6px 0 10px",
                      display: "flex", justifyContent: "center",
                    }}
                  >
                    <div style={{ width: 100, height: 4, borderRadius: 99, background: "rgba(255,255,255,.22)" }} />
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Bulle de message ─────────────────────────────────────────────── */
function ChatBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user"
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 6,
        animation: "bubbleIn .25s ease-out both",
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12,
          }}
        >🤖</div>
      )}
      <div
        style={{
          maxWidth: "80%",
          background: isUser
            ? "linear-gradient(135deg,#6366f1,#4f46e5)"
            : "rgba(255,255,255,.08)",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          padding: "9px 12px",
          border: isUser ? "none" : "1px solid rgba(255,255,255,.07)",
          boxShadow: isUser ? "0 2px 12px rgba(99,102,241,.3)" : "none",
        }}
      >
        <p
          style={{
            color: isUser ? "#fff" : "rgba(255,255,255,.88)",
            fontSize: 11, lineHeight: 1.55,
            whiteSpace: "pre-line", margin: 0,
          }}
        >
          {msg.text}
        </p>
      </div>
    </div>
  )
}

/* ─── Indicateur de frappe ─────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
      <div
        style={{
          width: 24, height: 24, borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, flexShrink: 0,
        }}
      >🤖</div>
      <div
        style={{
          background: "rgba(255,255,255,.08)",
          border: "1px solid rgba(255,255,255,.07)",
          borderRadius: "16px 16px 16px 4px",
          padding: "10px 14px",
          display: "flex", gap: 5, alignItems: "center",
          animation: "bubbleIn .25s ease-out both",
        }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "rgba(255,255,255,.5)",
              animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(8px) scale(.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typingDot {
          0%, 100% { opacity: .3; transform: translateY(0); }
          50%       { opacity: 1;  transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
