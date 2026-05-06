import { NextRequest, NextResponse } from "next/server"
import { requireAccountAdmin } from "@/lib/accountAuth"
import { getTenantAdmin } from "@/lib/supabaseTenant"
import { loadTenantPlanContext } from "@/lib/plansServer"
import { checkQuota } from "@/lib/plans"

/**
 * GET  /api/account/team   → liste des membres (profile + email Supabase)
 * POST /api/account/team   → invite un nouveau membre par email
 *
 * Quota check : refuse l'invitation si max_users du plan atteint.
 */

const ALLOWED_ROLES = ["directeur", "dispatcher", "comptable", "lecture"] as const
type Role = (typeof ALLOWED_ROLES)[number]


export async function GET(req: NextRequest) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  const supabase = await getTenantAdmin()

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, role, avatar_url, created_at")
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Récupère emails / last_sign_in_at via auth.admin.listUsers (1 page).
  // listUsers est paginée — pour les tenants à >50 users, ajouter pagination.
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 200 })
  const usersById = new Map(usersData?.users?.map(u => [u.id, u]) ?? [])

  const members = (profiles ?? []).map(p => {
    const u = usersById.get(p.id)
    return {
      id:              p.id,
      role:            p.role,
      avatar_url:      p.avatar_url,
      created_at:      p.created_at,
      email:           u?.email ?? null,
      last_sign_in_at: u?.last_sign_in_at ?? null,
      email_confirmed: !!u?.email_confirmed_at,
    }
  })

  // Quota info
  const ctx = await loadTenantPlanContext(auth.tenant.id)
  const quota = checkQuota(ctx, "users", members.length)

  return NextResponse.json({ members, quota })
}


export async function POST(req: NextRequest) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  let body: { email?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const email = (body.email || "").trim().toLowerCase()
  const role = (body.role || "dispatcher") as Role

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 })
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: `Rôle invalide (autorisés : ${ALLOWED_ROLES.join(", ")})` }, { status: 400 })
  }

  const supabase = await getTenantAdmin()

  // Quota check
  const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true })
  const ctx = await loadTenantPlanContext(auth.tenant.id)
  const quota = checkQuota(ctx, "users", count ?? 0)
  if (!quota.ok) {
    return NextResponse.json({
      error: `Quota utilisateurs atteint (${quota.current}/${quota.limit}). Passez à un plan supérieur pour inviter plus de membres.`,
      code: "QUOTA_EXCEEDED",
      kind: "users",
      current: quota.current,
      limit:   quota.limit,
    }, { status: 402 })
  }

  // Invite via Supabase Auth Admin (envoie email magic link)
  const baseUrl = process.env.SITE_BASE_URL || "https://vtcdashboard.com"
  const redirectTo = `${baseUrl}/?t=${auth.tenant.slug}`
  const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { invited_as: role, tenant_slug: auth.tenant.slug },
    redirectTo,
  })

  if (invErr || !invited?.user) {
    return NextResponse.json({ error: invErr?.message || "Invitation échouée" }, { status: 500 })
  }

  // Le trigger handle_new_user crée la row profiles avec role='dispatcher' par
  // défaut. On override avec le role demandé.
  await supabase
    .from("profiles")
    .upsert({ id: invited.user.id, role }, { onConflict: "id" })

  return NextResponse.json({
    ok:    true,
    user_id: invited.user.id,
    email:   invited.user.email,
    role,
    message: `Invitation envoyée à ${email}`,
  })
}
