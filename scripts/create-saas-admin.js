/**
 * Crée un compte saas_admin sur la DB master.
 *
 * Usage : EMAIL=... PASSWORD=... ROLE=superadmin node scripts/create-saas-admin.js
 *         (ou en interactif via prompt si non fournis)
 *
 * Étapes :
 *   1. auth.admin.createUser ({ email, password, email_confirm: true })
 *      → si user existe déjà, on récupère son id via listUsers
 *   2. INSERT (ou UPSERT) dans public.saas_admins (id, email, role)
 *
 * Idempotent : ré-exécutable sans casser quoi que ce soit.
 */

const fs = require("fs/promises")
const path = require("path")

async function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  const text = await fs.readFile(envPath, "utf-8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[m[1]] = val
    }
  }
}

async function api(masterUrl, serviceKey, path, init = {}) {
  const res = await fetch(`${masterUrl}${path}`, {
    ...init,
    headers: {
      "apikey":          serviceKey,
      "Authorization":   `Bearer ${serviceKey}`,
      "Content-Type":    "application/json",
      ...(init.headers || {}),
    },
  })
  const txt = await res.text()
  let json = null
  try { json = txt ? JSON.parse(txt) : null } catch { json = null }
  return { ok: res.ok, status: res.status, json, text: txt }
}


async function findUserByEmail(masterUrl, serviceKey, email) {
  // Auth admin API : GET /auth/v1/admin/users (paginé). On scanne jusqu'à
  // trouver l'email — pour ~10-100 users c'est OK.
  let page = 1
  while (page <= 20) {
    const r = await api(masterUrl, serviceKey, `/auth/v1/admin/users?page=${page}&per_page=100`)
    if (!r.ok) {
      console.error(`  listUsers HTTP ${r.status}: ${r.text.slice(0, 200)}`)
      return null
    }
    const users = r.json?.users || []
    if (!Array.isArray(users) || users.length === 0) return null
    const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (users.length < 100) return null     // dernière page
    page++
  }
  return null
}

async function createAuthUser(masterUrl, serviceKey, email, password) {
  const r = await api(masterUrl, serviceKey, `/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (r.ok) return r.json
  // user already registered → on récupère via listUsers
  if (
    r.status === 422 ||
    r.status === 409 ||
    /already.*registered|already.*exists|already_registered|email_exists/i.test(r.text)
  ) {
    console.log(`  ↷ User existe déjà, on le récupère…`)
    const existing = await findUserByEmail(masterUrl, serviceKey, email)
    if (existing) return existing
  }
  throw new Error(`createUser failed (${r.status}): ${r.text.slice(0, 300)}`)
}

async function upsertSaasAdmin(masterUrl, serviceKey, userId, email, role) {
  // PostgREST : POST avec Prefer: resolution=merge-duplicates pour upsert
  const r = await api(masterUrl, serviceKey, `/rest/v1/saas_admins?on_conflict=id`, {
    method: "POST",
    headers: {
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({ id: userId, email, role }),
  })
  if (!r.ok) {
    throw new Error(`upsert saas_admins failed (${r.status}): ${r.text.slice(0, 300)}`)
  }
  return r.json
}


async function main() {
  await loadEnv()

  const masterUrl  = process.env.MASTER_SUPABASE_URL
  const serviceKey = process.env.MASTER_SUPABASE_SERVICE_ROLE_KEY
  if (!masterUrl || !serviceKey) {
    console.error("✗ MASTER_SUPABASE_URL ou MASTER_SUPABASE_SERVICE_ROLE_KEY manquant")
    process.exit(1)
  }

  const email    = process.env.EMAIL
  const password = process.env.PASSWORD
  const role     = process.env.ROLE || "superadmin"
  if (!email || !password) {
    console.error("✗ Variables EMAIL et PASSWORD requises")
    console.error("  Usage : EMAIL=... PASSWORD=... node scripts/create-saas-admin.js")
    process.exit(1)
  }

  console.log(`▶ Création / récupération user ${email}…`)
  const user = await createAuthUser(masterUrl, serviceKey, email, password)
  if (!user || !user.id) {
    console.error("✗ Impossible de créer ou récupérer le user")
    process.exit(1)
  }
  console.log(`  User id: ${user.id}`)

  console.log(`▶ Upsert dans saas_admins (role=${role})…`)
  const admins = await upsertSaasAdmin(masterUrl, serviceKey, user.id, email, role)
  console.log(`  ✓ saas_admin enregistré : ${JSON.stringify(admins)}`)

  console.log(`\n✓ Terminé. Tu peux maintenant te connecter sur /saas/login avec :`)
  console.log(`  Email    : ${email}`)
  console.log(`  Password : (celui que tu as fourni)`)
}

main().catch(e => {
  console.error("✗ Erreur fatale:", e.message)
  process.exit(1)
})
