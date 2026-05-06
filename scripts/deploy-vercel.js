/**
 * Déploiement Vercel automatisé.
 *
 * 1. Cherche un projet Vercel lié à bigotb9/vtc-saas (ou par nom 'vtc-saas')
 * 2. Si non trouvé, le crée et le lie au repo GitHub
 * 3. Configure toutes les env vars (production + preview)
 * 4. Déclenche un déploiement
 * 5. Poll jusqu'à success/error
 * 6. Affiche l'URL finale
 *
 * Usage : VERCEL_TOKEN=... node scripts/deploy-vercel.js
 */

const fs = require("fs/promises")
const path = require("path")
const crypto = require("crypto")

const REPO_OWNER  = "bigotb9"
const REPO_NAME   = "vtc-saas"
const PROJECT_NAME = "vtc-saas"


// ── Charge .env.local ──
async function loadEnv() {
  const text = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf-8")
  const out = {}
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) {
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      out[m[1]] = val
    }
  }
  return out
}


// ── Wrapper API Vercel ──
function makeApi(token) {
  return async function api(path, init = {}) {
    const res = await fetch(`https://api.vercel.com${path}`, {
      ...init,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
        ...(init.headers || {}),
      },
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch {}
    return { ok: res.ok, status: res.status, json, text }
  }
}


// ── Étape 1 : trouver / créer le projet ──
async function findOrCreateProject(api) {
  console.log("▶ Recherche du projet Vercel…")
  // Liste tous les projets (paginé)
  const r = await api(`/v9/projects?limit=100`)
  if (!r.ok) throw new Error(`list projects: ${r.status} ${r.text.slice(0, 200)}`)

  const projects = r.json?.projects || []
  const found = projects.find(p =>
    p.name === PROJECT_NAME ||
    p.link?.repo === REPO_NAME && p.link?.org === REPO_OWNER ||
    p.link?.repoOwnerLogin === REPO_OWNER && p.link?.repoName === REPO_NAME
  )

  if (found) {
    console.log(`  ✓ Projet trouvé : ${found.name} (id=${found.id})`)
    return found
  }

  console.log(`  ↷ Aucun projet trouvé, création…`)
  const create = await api(`/v11/projects`, {
    method: "POST",
    body: JSON.stringify({
      name: PROJECT_NAME,
      framework: "nextjs",
      gitRepository: {
        type: "github",
        repo: `${REPO_OWNER}/${REPO_NAME}`,
      },
    }),
  })
  if (!create.ok) {
    throw new Error(`create project: ${create.status} ${create.text.slice(0, 400)}`)
  }
  console.log(`  ✓ Projet créé : ${create.json.name} (id=${create.json.id})`)
  return create.json
}


// ── Étape 2 : env vars ──
async function buildEnvVarsList(env) {
  const internalWorkerToken = crypto.randomBytes(32).toString("hex")
  const cronSecret          = crypto.randomBytes(32).toString("hex")

  const vars = [
    // Master Supabase
    { key: "MASTER_SUPABASE_URL",                value: env.MASTER_SUPABASE_URL },
    { key: "MASTER_SUPABASE_ANON_KEY",           value: env.MASTER_SUPABASE_ANON_KEY },
    { key: "MASTER_SUPABASE_SERVICE_ROLE_KEY",   value: env.MASTER_SUPABASE_SERVICE_ROLE_KEY },
    { key: "NEXT_PUBLIC_MASTER_SUPABASE_URL",    value: env.NEXT_PUBLIC_MASTER_SUPABASE_URL },
    { key: "NEXT_PUBLIC_MASTER_SUPABASE_ANON_KEY", value: env.NEXT_PUBLIC_MASTER_SUPABASE_ANON_KEY },

    // Management API
    { key: "SUPABASE_ACCESS_TOKEN", value: env.SUPABASE_ACCESS_TOKEN },
    { key: "SUPABASE_ORG_ID",       value: env.SUPABASE_ORG_ID },

    // Resend (déjà configuré)
    { key: "RESEND_API_KEY", value: env.RESEND_API_KEY },

    // Secrets internes (générés aléatoirement)
    { key: "INTERNAL_WORKER_TOKEN", value: internalWorkerToken },
    { key: "CRON_SECRET",           value: cronSecret },

    // Comportement
    { key: "PAYMENT_MODE",          value: "stub" },

    // SITE_BASE_URL : on le set après le 1er deploy avec l'URL réelle.
    // Pour l'instant on met une valeur placeholder qui sera surchargée.
    // Toujours une valeur Vercel.app valide pour qu'app fonctionne dès le boot.
    { key: "SITE_BASE_URL", value: `https://${PROJECT_NAME}.vercel.app` },
  ]

  // Validation : aucune valeur vide
  const missing = vars.filter(v => !v.value)
  if (missing.length > 0) {
    throw new Error(`Env vars manquantes dans .env.local : ${missing.map(v => v.key).join(", ")}`)
  }

  return { vars, internalWorkerToken, cronSecret }
}


async function pushEnvVars(api, projectId, vars) {
  // Récupère les vars existantes pour upsert proprement
  console.log(`▶ Push de ${vars.length} env vars (production + preview)…`)

  const existing = await api(`/v9/projects/${projectId}/env?decrypt=false`)
  const existingByKey = new Map()
  if (existing.ok) {
    for (const e of existing.json?.envs || []) {
      existingByKey.set(e.key, e)
    }
  }

  for (const v of vars) {
    const old = existingByKey.get(v.key)
    if (old) {
      // PATCH la var existante. On NE re-spécifie PAS `type` — Vercel rejette
      // si la var existante est marquée 'sensitive'. On préserve son type.
      const r = await api(`/v9/projects/${projectId}/env/${old.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          value:  v.value,
          target: ["production", "preview"],
        }),
      })
      if (!r.ok) {
        console.error(`  ✗ ${v.key}: PATCH failed ${r.status} ${r.text.slice(0, 200)}`)
        continue
      }
      console.log(`  ✓ ${v.key} (updated, type=${old.type})`)
    } else {
      const r = await api(`/v10/projects/${projectId}/env`, {
        method: "POST",
        body: JSON.stringify({
          key:    v.key,
          value:  v.value,
          target: ["production", "preview"],
          type:   "encrypted",
        }),
      })
      if (!r.ok) {
        console.error(`  ✗ ${v.key}: POST failed ${r.status} ${r.text.slice(0, 200)}`)
        continue
      }
      console.log(`  ✓ ${v.key} (created)`)
    }
  }
}


// ── Étape 3 : déclencher un déploiement ──
async function triggerDeploy(api, projectName, project) {
  console.log(`▶ Déclenchement d'un déploiement production…`)
  // Vercel exige repoId (numérique GitHub), pas seulement repo (slug).
  // On lit project.link qui contient les infos GitHub depuis le link existant.
  const link = project.link || {}
  const repoId = link.repoId
  if (!repoId) {
    throw new Error(`Impossible de récupérer le repoId GitHub depuis project.link (link=${JSON.stringify(link).slice(0, 200)})`)
  }

  const r = await api(`/v13/deployments`, {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      target: "production",
      project: project.id,
      gitSource: {
        type:   "github",
        repoId,
        ref:    "main",
      },
    }),
  })
  if (!r.ok) throw new Error(`trigger deploy: ${r.status} ${r.text.slice(0, 400)}`)
  console.log(`  ✓ Déploiement créé : id=${r.json.id} url=https://${r.json.url}`)
  return r.json
}


// ── Étape 4 : poll status ──
async function waitForDeploy(api, deployId, maxMs = 10 * 60 * 1000) {
  console.log(`▶ Attente du build (max 10min)…`)
  const start = Date.now()
  let lastState = ""
  while (Date.now() - start < maxMs) {
    const r = await api(`/v13/deployments/${deployId}`)
    if (!r.ok) {
      console.error(`  ✗ poll: ${r.status} ${r.text.slice(0, 200)}`)
      await sleep(5000)
      continue
    }
    const state = r.json.readyState || r.json.status
    if (state !== lastState) {
      const elapsed = Math.round((Date.now() - start) / 1000)
      console.log(`  • ${elapsed}s — état : ${state}`)
      lastState = state
    }
    if (state === "READY")     return { ok: true,  json: r.json }
    if (state === "ERROR")     return { ok: false, json: r.json }
    if (state === "CANCELED")  return { ok: false, json: r.json }
    await sleep(5000)
  }
  throw new Error("Timeout attente déploiement (10min)")
}


function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }


// ── Main ──
async function main() {
  const token = process.env.VERCEL_TOKEN
  if (!token) {
    console.error("✗ VERCEL_TOKEN manquant. Usage : VERCEL_TOKEN=... node scripts/deploy-vercel.js")
    process.exit(1)
  }

  const api = makeApi(token)
  const env = await loadEnv()

  // 1. Projet
  const project = await findOrCreateProject(api)
  const projectId = project.id

  // 2. Env vars
  const { vars, internalWorkerToken, cronSecret } = await buildEnvVarsList(env)
  await pushEnvVars(api, projectId, vars)

  // 3. Deploy
  const deploy = await triggerDeploy(api, PROJECT_NAME, project)
  const result = await waitForDeploy(api, deploy.id)

  if (!result.ok) {
    console.error(`\n✗ Déploiement échoué`)
    console.error(`  URL: https://${result.json.url}`)
    console.error(`  errorCode: ${result.json.errorCode || "n/a"}`)
    console.error(`  errorMessage: ${result.json.errorMessage || "n/a"}`)
    process.exit(2)
  }

  // 4. Récupérer URL finale + ajuster SITE_BASE_URL si différente
  const finalUrl = `https://${result.json.url}`
  const aliasUrl = result.json.alias?.[0] ? `https://${result.json.alias[0]}` : finalUrl

  console.log(`\n✓ Déploiement réussi`)
  console.log(`  URL preview     : ${finalUrl}`)
  console.log(`  URL production  : ${aliasUrl}`)
  console.log(`\n📝 Secrets générés (à conserver) :`)
  console.log(`  INTERNAL_WORKER_TOKEN = ${internalWorkerToken}`)
  console.log(`  CRON_SECRET           = ${cronSecret}`)

  // Vérifier si l'URL alias diffère du SITE_BASE_URL initial → mettre à jour
  const desiredBase = aliasUrl
  const initialBase = `https://${PROJECT_NAME}.vercel.app`
  if (desiredBase !== initialBase) {
    console.log(`\n▶ Mise à jour SITE_BASE_URL → ${desiredBase}`)
    const existing = await api(`/v9/projects/${projectId}/env?decrypt=false`)
    const old = (existing.json?.envs || []).find(e => e.key === "SITE_BASE_URL")
    if (old) {
      const r = await api(`/v9/projects/${projectId}/env/${old.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          value:  desiredBase,
          target: ["production", "preview"],
          type:   "encrypted",
        }),
      })
      if (r.ok) console.log("  ✓ SITE_BASE_URL ajusté")
      else console.error(`  ✗ ${r.status} ${r.text.slice(0, 200)}`)
    }
  }
}

main().catch(e => {
  console.error("✗ Erreur fatale:", e.message)
  process.exit(1)
})
