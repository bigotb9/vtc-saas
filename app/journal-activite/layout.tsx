import type { Metadata } from "next"
export const metadata: Metadata = { title: "Journal d'activité" }
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
