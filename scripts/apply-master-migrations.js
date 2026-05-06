/**
 * Applique les migrations master via l'API Supabase Management.
 *
 * Lit MASTER_SUPABASE_URL et SUPABASE_ACCESS_TOKEN depuis .env.local et
 * exécute chaque fichier .sql dans supabase/master/ dans l'ordre.
 *
 * Usage : node scripts/apply-master-migrations.js
 *
 * Idempotence : si une migration échoue avec "already exists", on log et
 * continue (probablement déjà appliquée). Tout autre erreur arrête le script.
 */

const fs = require("fs/promises")
const path = require("path")

// ── Charger .env.local ──
async function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  const text = await fs.readFile(envPath, "utf-8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      // Supprime guillemets éventuels
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[m[1]] = val
    }
  }
}

function masterRefFromUrl(url) {
  // https://<ref>.supabase.co → <ref>
  const m = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/)
  if (!m) throw new Error(`Impossible d'extraire le ref depuis ${url}`)
  return m[1]
}

async function runSql(ref, token, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, body: text }
  }
  return { ok: true, body: text }
}

const ALREADY_EXISTS_PATTERNS = [
  /already exists/i,
  /already enabled/i,
  /duplicate_object/i,
  /duplicate_table/i,
]

function isAlreadyExists(body) {
  return ALREADY_EXISTS_PATTERNS.some(re => re.test(body))
}

async function main() {
  await loadEnv()

  const url = process.env.MASTER_SUPABASE_URL
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!url || !token) {
    console.error("✗ MASTER_SUPABASE_URL ou SUPABASE_ACCESS_TOKEN manquant dans .env.local")
    process.exit(1)
  }

  const ref = masterRefFromUrl(url)
  console.log(`▶ Master project ref: ${ref}`)

  const dir = path.join(process.cwd(), "supabase", "master")
  const files = (await fs.readdir(dir)).filter(f => f.endsWith(".sql")).sort()

  let applied = 0
  let skipped = 0

  for (const f of files) {
    process.stdout.write(`▶ ${f}… `)
    const sql = await fs.readFile(path.join(dir, f), "utf-8")
    const result = await runSql(ref, token, sql)

    if (result.ok) {
      console.log("✓ OK")
      applied++
      continue
    }

    if (isAlreadyExists(result.body)) {
      console.log("↷ déjà appliquée (skip)")
      skipped++
      continue
    }

    console.log("✗ ÉCHEC")
    console.error(`  Status: ${result.status}`)
    console.error(`  Body:   ${result.body.slice(0, 600)}`)
    process.exit(1)
  }

  console.log(`\n✓ Terminé. Appliquées : ${applied}, Skipped : ${skipped}`)
}

main().catch(e => {
  console.error("✗ Erreur fatale:", e.message)
  process.exit(1)
})
