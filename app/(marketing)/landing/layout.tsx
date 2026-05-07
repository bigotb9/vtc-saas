/**
 * Layout override pour la landing — supprime le header/footer du layout
 * marketing parent. La landing gère sa propre Nav et son Footer.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
