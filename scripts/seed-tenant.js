// Seed d'un tenant VTC avec 6 mois de données cohérentes (démo client).
//
// Usage : node scripts/seed-tenant.js [slug]
//   - slug par défaut : "test-transport"
//
// Le script :
//   1. Lit les credentials master depuis .env.local
//   2. Récupère les credentials du tenant depuis master.tenants
//   3. Vide les tables data du tenant
//   4. Insère ~20 véhicules / ~42 chauffeurs / ~184 jours de recettes,
//      dépenses, entretiens, versements, attributions et alertes.
//   5. Laisse Postgres gérer les sequences (pas d'ID forcé sauf besoin).
//
// Volumes générés (approx.) :
//   - 8 clients, 20 véhicules, 42 chauffeurs, ~60 affectations
//   - ~900 commandes Yango, ~5500 recettes Wave
//   - ~80 dépenses, ~80 entretiens, ~160 tâches
//   - ~950 versements chauffeurs, 48 versements clients
//   - ~5500 attributions, 6 insights AI, 12 alertes

const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { createClient } = require("@supabase/supabase-js")

// ─────────────── env ───────────────
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, "utf-8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (value.startsWith("\"") && value.endsWith("\"")) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}
loadEnvFile(path.join(process.cwd(), ".env.local"))

const SLUG = process.argv[2] || "test-transport"

const MASTER_URL = process.env.MASTER_SUPABASE_URL
const MASTER_KEY = process.env.MASTER_SUPABASE_SERVICE_ROLE_KEY
if (!MASTER_URL || !MASTER_KEY) {
  console.error("Manque MASTER_SUPABASE_URL ou MASTER_SUPABASE_SERVICE_ROLE_KEY dans .env.local")
  process.exit(1)
}

// ─────────────── helpers ───────────────
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[rnd(0, arr.length - 1)]
const pad = (n, s = 2) => String(n).padStart(s, "0")
const fmtDate = (d) => d.toISOString().slice(0, 10)
const fmtDT = (d) => d.toISOString().slice(0, 19) + "Z"
const addDays = (d, n) => { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r }
const addMonths = (d, n) => { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + n); return r }
const isSunday = (d) => d.getUTCDay() === 0
const prevWorkday = (d) => {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() - 1)
  while (isSunday(r)) r.setUTCDate(r.getUTCDate() - 1)
  return r
}
const diffWorkdays = (a, b) => {
  const start = a < b ? new Date(a) : new Date(b)
  const end = a < b ? new Date(b) : new Date(a)
  let count = 0
  const c = new Date(start)
  while (c < end) {
    c.setUTCDate(c.getUTCDate() + 1)
    if (c.getUTCDay() !== 0) count++
  }
  return count
}

async function insertChunks(supa, table, rows, opts = {}) {
  if (!rows || rows.length === 0) return []
  const { select = false, chunkSize = 500 } = opts
  const all = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    let q = supa.from(table).insert(chunk)
    if (select) q = q.select(select === true ? "*" : select)
    const { data, error } = await q
    if (error) throw new Error(`Insert ${table} (chunk ${i}-${i + chunk.length}): ${error.message}`)
    if (data) all.push(...data)
  }
  return all
}

async function deleteAll(supa, table, key = "id") {
  const { error } = await supa.from(table).delete().not(key, "is", null)
  if (error) throw new Error(`Delete ${table}: ${error.message}`)
}

// ─────────────── data generators ───────────────
function genClients() {
  return [
    "Auto Express CI",
    "Transports Azur",
    "Sawa Logistique",
    "PackMobil Africa",
    "CFA Cargo",
    "Proxi Cab Abidjan",
    "Eco Drive Group",
    "City Shuttle SARL",
  ].map((nom) => ({
    nom,
    telephone: `+22507${rnd(10000000, 99999999)}`,
    email: `${nom.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
    notes: "Client régulier — facturation mensuelle.",
    created_at: fmtDT(new Date(Date.now() - rnd(40, 400) * 86400000)),
  }))
}

function genVehicules(clients, baseDate) {
  const templates = [
    ["Toyota", "Yaris"], ["Toyota", "Corolla"], ["Toyota", "Vitz"],
    ["Dacia", "Sandero"], ["Dacia", "Logan"],
    ["Hyundai", "Accent"], ["Hyundai", "i10"],
    ["Kia", "Rio"], ["Kia", "Picanto"],
    ["Renault", "Clio"], ["Renault", "Symbol"],
    ["Peugeot", "208"], ["Peugeot", "301"],
    ["Nissan", "Micra"], ["Nissan", "Sunny"],
    ["Suzuki", "Swift"], ["Suzuki", "Alto"],
    ["Volkswagen", "Polo"], ["Volkswagen", "Golf"],
    ["Citroen", "C-Elysée"],
  ]
  const out = []
  for (let i = 0; i < 20; i++) {
    const [, model] = templates[i]
    const plate = `CI-${rnd(1000, 9999)}${String.fromCharCode(65 + (i % 6))}${String.fromCharCode(65 + ((i + 3) % 6))}`
    const statut = i < 17 ? "ACTIF" : pick(["EN MAINTENANCE", "GARAGE", "RESERVE"])
    const startKm = rnd(82000, 185000)
    // Recette journalière cible par véhicule : 20 000 FCFA (avec petite variation pour le réalisme)
    const recetteJour = rnd(18000, 22000)
    const assuranceDate = addDays(baseDate, rnd(20, 100))
    const visiteDate = addMonths(assuranceDate, 6)
    const patenteDate = addMonths(baseDate, rnd(1, 4))
    const parkingDate = addMonths(baseDate, rnd(1, 4))
    out.push({
      _tmpIndex: i,
      _tmpModel: model,
      immatriculation: plate,
      type_vehicule: pick(["Taxi", "VTC", "Berline", "Compact"]),
      proprietaire: pick(clients).nom,
      statut,
      "montant de la recette": recetteJour,
      km_actuel: startKm,
      km_derniere_vidange: Math.max(500, startKm - rnd(1500, 6500)),
      date_derniers_pneus: fmtDate(addDays(baseDate, rnd(10, 50))),
      date_assurance: fmtDate(assuranceDate),
      date_expiration_assurance: fmtDate(addMonths(assuranceDate, 12)),
      date_visite_technique: fmtDate(visiteDate),
      date_expiration_visite: fmtDate(addMonths(visiteDate, 12)),
      photo: null,
      carte_grise_recto: null,
      carte_grise_verso: null,
      sous_gestion: rnd(0, 1) === 1,
      montant_mensuel_client: rnd(120000, 220000),
      id_client: pick(clients).id,
      date_carte_stationnement: fmtDate(parkingDate),
      date_expiration_carte_stationnement: fmtDate(addMonths(parkingDate, 12)),
      date_patente: fmtDate(patenteDate),
      date_expiration_patente: fmtDate(addMonths(patenteDate, 12)),
      montant_recette_jour: recetteJour,
    })
  }
  return out
}

function genChauffeurs() {
  const noms = [
    "Souleymane Konan", "Aminata Diallo", "Mamadou Traoré", "Fatoumata Kone",
    "Ousmane Coulibaly", "Rokia Diabaté", "Issa Sangaré", "Aïssata Fofana",
    "Serge Koffi", "Marie N'Guessan", "Alain N'Dri", "Salimata Touré",
    "Adama Bamba", "Awa Cissé", "Bakary Doumbia", "Khady Sylla",
    "Boubacar Kouyaté", "Sira Camara", "Drissa Ouattara", "Mariam Sow",
    "Abdoulaye Konaté", "Coumba Bah", "Tiémoko Soro", "Diaminatou Sangaré",
    "Yacouba Berté", "Penda Niang", "Ibrahima Bagayoko", "Fanta Kéita",
    "Moussa Cissoko", "Ramatoulaye Tall", "Lassina Coulibaly", "Awa Doumbia",
    "Cheick Tidiane", "Maimouna Bah", "Karim Sissoko", "Adja Diop",
    "Modibo Sangaré", "Salam Diakité", "Yaya Bamba", "Néné Camara",
    "Sékou Konaté", "Hawa Touré",
  ]
  return noms.map((nom, i) => ({
    _tmpIndex: i,
    nom,
    numero_wave: `+22507${rnd(10000000, 99999999)}`,
    actif: i < 38,
    commentaire: pick([
      "Chauffeur expérimenté, bon taux de satisfaction.",
      "Ponctuel, retours clients positifs.",
      "Fiable sur les longues courses.",
      "Connaît bien Abidjan et la Riviera.",
      "Permis depuis plus de 8 ans, prudent.",
    ]),
    photo: null,
    photo_permis_recto: null,
    photo_permis_verso: null,
    numero_permis: `PERM-${rnd(100000, 999999)}`,
    numero_cni: `CNI-${rnd(100000, 999999)}`,
    situation_matrimoniale: pick(["Célibataire", "Marié", "Divorcé"]),
    nombre_enfants: rnd(0, 4),
    domicile: pick(["Abidjan", "Yamoussoukro", "Bingerville", "Grand-Bassam", "Anyama", "Bouaké"]),
    numero_garant: `+22501${rnd(10000000, 99999999)}`,
  }))
}

// ─────────────── attributions builder (calque de seed-data.js) ───────────────
function buildAttributions(recettes, vehiculesById, feriesMap) {
  const byVehicule = new Map()
  for (const r of recettes) {
    if (!r.id_vehicule) continue
    if (!byVehicule.has(r.id_vehicule)) byVehicule.set(r.id_vehicule, [])
    byVehicule.get(r.id_vehicule).push(r)
  }
  const out = []
  for (const [idVehicule, txs] of byVehicule.entries()) {
    const vInfo = vehiculesById.get(idVehicule)
    if (!vInfo) continue
    const expectedBase = Number(vInfo.montant_recette_jour || 90000)
    const sorted = txs.slice().sort((a, b) => a.Horodatage.localeCompare(b.Horodatage))
    const attributedDays = new Set()
    for (const r of sorted) {
      const dWave = new Date(r.Horodatage)
      const dWaveIso = fmtDate(dWave)
      const montant = Number(r["Montant net"] || 0)
      if (montant <= 0) continue
      const expected = feriesMap.get(dWaveIso) ?? expectedBase

      if (expected > 0) {
        const ratio = montant / expected
        const n = Math.round(ratio)
        if (n >= 2 && Math.abs(montant - n * expected) <= expected * 0.05) {
          const part = Math.round(montant / n)
          let placed = 0
          let back = new Date(dWave)
          for (let i = 0; i < 15 && placed < n; i++) {
            back = prevWorkday(back)
            const iso = fmtDate(back)
            if (attributedDays.has(iso)) continue
            out.push({ id_recette: r._localId, id_vehicule: idVehicule, jour_exploitation: iso, montant_attribue: part, type_attribution: "split_2j" })
            attributedDays.add(iso)
            placed++
          }
          continue
        }
      }

      const targetDay = prevWorkday(dWave)
      const targetISO = fmtDate(targetDay)
      if (!attributedDays.has(targetISO)) {
        const gap = diffWorkdays(dWave, targetDay)
        out.push({ id_recette: r._localId, id_vehicule: idVehicule, jour_exploitation: targetISO, montant_attribue: montant, type_attribution: gap > 1 ? "retard" : "normal" })
        attributedDays.add(targetISO)
      } else {
        let backDay = new Date(targetDay)
        let backISO = null
        for (let i = 0; i < 6; i++) {
          backDay = prevWorkday(backDay)
          const iso = fmtDate(backDay)
          if (!attributedDays.has(iso)) { backISO = iso; break }
        }
        if (backISO) {
          out.push({ id_recette: r._localId, id_vehicule: idVehicule, jour_exploitation: backISO, montant_attribue: montant, type_attribution: "retard" })
          attributedDays.add(backISO)
        } else {
          let finalDay = new Date(dWave)
          let finalISO = dWaveIso
          let safety = 15
          while (attributedDays.has(finalISO) && safety > 0) {
            finalDay.setUTCDate(finalDay.getUTCDate() + 1)
            while (isSunday(finalDay)) finalDay.setUTCDate(finalDay.getUTCDate() + 1)
            finalISO = fmtDate(finalDay)
            safety--
          }
          out.push({ id_recette: r._localId, id_vehicule: idVehicule, jour_exploitation: finalISO, montant_attribue: montant, type_attribution: "jour_meme" })
          attributedDays.add(finalISO)
        }
      }
    }
  }
  return out
}

// ─────────────── main ───────────────
async function main() {
  // 1) connect master
  const master = createClient(MASTER_URL, MASTER_KEY, { auth: { persistSession: false } })
  console.log(`📡 Recherche du tenant '${SLUG}' dans master…`)
  const { data: tenant, error: tenantErr } = await master
    .from("tenants")
    .select("id, slug, nom, supabase_url, supabase_service_key, provisioning_status, statut")
    .eq("slug", SLUG)
    .maybeSingle()
  if (tenantErr) throw new Error(`Master query: ${tenantErr.message}`)
  if (!tenant) throw new Error(`Tenant '${SLUG}' introuvable dans la base master`)
  if (tenant.provisioning_status !== "ready") throw new Error(`Tenant '${SLUG}' n'est pas ready (status=${tenant.provisioning_status})`)
  console.log(`   ✓ ${tenant.nom} (${tenant.supabase_url})`)

  // 2) connect tenant
  const supa = createClient(tenant.supabase_url, tenant.supabase_service_key, { auth: { persistSession: false } })

  // 3) cleanup (ordre = inverse des dépendances)
  console.log("🧹 Nettoyage des tables data…")
  const cleanup = [
    ["versement_attribution", "id"],
    ["versements_chauffeurs", "id"],
    ["versements_clients", "id"],
    ["taches_suivi", "id"],
    ["justifications_versement", "id"],
    ["entretiens", "id"],
    ["depenses_vehicules", "id_depense"],
    ["affectation_chauffeurs_vehicules", "id_affectation"],
    ["commandes_yango", "id"],
    ["recettes_wave", "id"],
    ["alertes_envoyees", "id"],
    ["ai_insights", "id"],
    ["jours_feries", "date"],
    ["vehicules", "id_vehicule"],
    ["chauffeurs", "id_chauffeur"],
    ["clients", "id"],
  ]
  for (const [table, key] of cleanup) {
    process.stdout.write(`   - ${table}… `)
    await deleteAll(supa, table, key)
    console.log("✓")
  }

  // 4) build & insert refs
  const today = new Date()
  const baseDate = addDays(today, -184)

  console.log("\n👥 Insert clients…")
  const clientsRaw = genClients()
  const clients = await insertChunks(supa, "clients", clientsRaw, { select: "id, nom" })
  console.log(`   ✓ ${clients.length} clients`)

  console.log("🚗 Insert vehicules…")
  const vehiculesRaw = genVehicules(clients, baseDate)
  // map client-name -> id pour ne pas dépendre des id_client générés
  const vehiculesPayload = vehiculesRaw.map((v) => {
    const { _tmpIndex, _tmpModel, ...row } = v
    return row
  })
  const vehicules = await insertChunks(supa, "vehicules", vehiculesPayload, { select: "id_vehicule, immatriculation, montant_recette_jour, km_actuel" })
  console.log(`   ✓ ${vehicules.length} véhicules`)

  console.log("🧑‍✈️ Insert chauffeurs…")
  const chauffeursRaw = genChauffeurs()
  const chauffeursPayload = chauffeursRaw.map((c) => {
    const { _tmpIndex, ...row } = c
    return row
  })
  const chauffeurs = await insertChunks(supa, "chauffeurs", chauffeursPayload, { select: "id_chauffeur, nom, numero_wave, actif" })
  console.log(`   ✓ ${chauffeurs.length} chauffeurs`)

  // 5) affectations chauffeur ↔ véhicule (rotations)
  console.log("📌 Affectations chauffeurs/véhicules…")
  const activeChauffeurs = chauffeurs.filter((c) => c.actif)
  const activeVehicules = vehicules.slice(0, 17) // les 17 premiers actifs
  const assignments = []
  let vIdx = 0
  for (const ch of activeChauffeurs) {
    const parts = rnd(1, 2)
    let cursor = new Date(baseDate)
    for (let p = 0; p < parts; p++) {
      const isLast = p === parts - 1
      const dur = isLast ? 999 : rnd(40, 90)
      const dDeb = addDays(cursor, rnd(0, 6))
      const dFin = isLast ? null : fmtDate(addDays(dDeb, dur))
      const veh = activeVehicules[vIdx % activeVehicules.length]
      assignments.push({
        id_chauffeur: ch.id_chauffeur,
        id_vehicule: veh.id_vehicule,
        date_debut: fmtDate(dDeb),
        date_fin: dFin,
        created_at: fmtDT(addDays(dDeb, rnd(0, 2))),
      })
      cursor = addDays(dDeb, dur + 1)
      vIdx++
    }
  }
  await insertChunks(supa, "affectation_chauffeurs_vehicules", assignments)
  console.log(`   ✓ ${assignments.length} affectations`)

  // 6) jours fériés
  console.log("📅 Jours fériés…")
  const feriesData = [
    { date: "2025-12-25", libelle: "Noël", montant: 15000 },
    { date: "2026-01-01", libelle: "Jour de l'an", montant: 15000 },
    { date: "2026-05-01", libelle: "Fête du travail", montant: 15000 },
    { date: "2026-08-07", libelle: "Fête de l'indépendance", montant: 15000 },
  ]
  await insertChunks(supa, "jours_feries", feriesData)
  console.log(`   ✓ ${feriesData.length} jours fériés`)

  // 7) finder pour assignment courant
  function findVehiculeForChauffeur(chauffeurId, isoDay) {
    const matches = assignments
      .filter((a) => a.id_chauffeur === chauffeurId)
      .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""))
    for (const a of matches) {
      if (!a.date_debut) continue
      if (isoDay >= a.date_debut && (!a.date_fin || isoDay <= a.date_fin)) return a.id_vehicule
    }
    return matches.find((a) => !a.date_fin)?.id_vehicule || matches.at(-1)?.id_vehicule || null
  }

  // 8) commandes Yango + recettes Wave (par jour)
  console.log("🛺 Commandes Yango et 💸 Recettes Wave…")
  const commandes = []
  const recettes = []
  const paymentMethods = ["cash", "card", "mobile_money"]
  const categories = ["Transport", "Delivery", "Business", "Personal"]
  const clientsList = clients
  const chauffeursById = new Map(chauffeurs.map((c) => [c.id_chauffeur, c]))

  for (let day = 0; day < 184; day++) {
    const date = addDays(baseDate, day)
    const dayIso = fmtDate(date)
    const workday = !isSunday(date)

    const ordersToday = workday ? rnd(4, 7) : rnd(1, 3)
    for (let i = 0; i < ordersToday; i++) {
      const createdAt = new Date(date)
      createdAt.setUTCHours(rnd(5, 22), rnd(0, 59), rnd(0, 59), 0)
      const status = rnd(1, 100) < 82 ? "complete" : pick(["cancelled", "driving", "waiting"])
      const ch = pick(activeChauffeurs)
      const vId = findVehiculeForChauffeur(ch.id_chauffeur, dayIso) || pick(activeVehicules).id_vehicule
      const veh = vehicules.find((v) => v.id_vehicule === vId) || pick(activeVehicules)
      const price = rnd(2500, 28000)
      commandes.push({
        id: `YNG-${dayIso}-${i}-${vId}-${rnd(1000, 9999)}`,
        short_id: 1000000 + commandes.length,
        status,
        created_at: fmtDT(createdAt),
        ended_at: status === "complete" ? fmtDT(new Date(createdAt.getTime() + rnd(8, 45) * 60000)) : null,
        raw: {
          price,
          driver_profile: { id: `driver-${ch.id_chauffeur}`, name: ch.nom },
          car: { brand_model: `${veh.immatriculation} · Taxi`, brand: "Toyota", model: "Yaris", number: veh.immatriculation },
          payment_method: pick(paymentMethods),
          category: pick(categories),
        },
      })
    }

    if (!workday) continue

    // Recette journalière : 1 versement par VÉHICULE actif et par jour ouvré (~20k FCFA cible).
    // Si 2 chauffeurs sont affectés au même véhicule ce jour-là, on en choisit un seul.
    // ~12% des jours, le véhicule ne roule pas (panne, pause, etc.)
    for (const v of activeVehicules) {
      if (rnd(1, 100) <= 12) continue
      const drivers = assignments
        .filter((a) => a.id_vehicule === v.id_vehicule && dayIso >= a.date_debut && (!a.date_fin || dayIso <= a.date_fin))
        .map((a) => chauffeursById.get(a.id_chauffeur))
        .filter(Boolean)
      if (drivers.length === 0) continue
      const ch = pick(drivers)
      const expected = Number(v.montant_recette_jour || 20000)
      // 72% au montant attendu (±10%), 18% un peu plus (bonne journée), 10% en dessous (jour mou / retard)
      const r = rnd(1, 100)
      let amount
      if (r <= 72) amount = Math.round(expected * (rnd(95, 110) / 100))
      else if (r <= 90) amount = Math.round(expected * (rnd(115, 135) / 100))
      else amount = Math.round(expected * (rnd(55, 88) / 100))
      const heure = rnd(17, 22)
      const t = new Date(date)
      t.setUTCHours(heure, rnd(0, 59), rnd(0, 59), 0)
      const localId = recettes.length + 1
      recettes.push({
        _localId: localId,
        id_recette: 200000 + localId,
        Horodatage: fmtDT(t),
        "Identifiant de transaction": `WAVE-${dayIso}-V${v.id_vehicule}-${rnd(10000, 99999)}`,
        "Type de transaction": "Versement chauffeur",
        "Montant net": amount,
        "Montant brut": amount + rnd(200, 1200),
        Frais: rnd(200, 1200),
        Solde: amount,
        Devise: "XOF",
        "Nom de contrepartie": ch.nom,
        "Numéro de téléphone de contrepartie": ch.numero_wave,
        "Nom d'utilisateur": pick(clientsList).nom,
        "Numéro de téléphone d'utilisateur": pick(clientsList).telephone || "+2250700000000",
        date_paiement: dayIso,
        date_travail: dayIso,
        telephone_chauffeur: ch.numero_wave,
        id_vehicule: v.id_vehicule,
      })
    }
  }
  await insertChunks(supa, "commandes_yango", commandes)
  console.log(`   ✓ ${commandes.length} commandes Yango`)

  // recettes : on insère sans `id` (généré), `_localId`, ni `id_vehicule` (cette colonne n'existe pas dans recettes_wave — le lien véhicule passe par la vue via le téléphone chauffeur)
  const recettesPayload = recettes.map((r) => {
    const { _localId, id_vehicule, ...row } = r
    return row
  })
  await insertChunks(supa, "recettes_wave", recettesPayload)
  console.log(`   ✓ ${recettes.length} recettes Wave`)

  // 9) dépenses — par catégorie réaliste, puis scalées pour atteindre 35% du CA total
  console.log("💰 Dépenses véhicules…")
  const expenseCats = [
    { type: "Carburant",        countRange: [10, 18], amountRange: [6000, 18000],   desc: ["Plein carburant", "Recharge essence", "Carburant station"] },
    { type: "Réparation",       countRange: [2, 4],   amountRange: [55000, 220000], desc: ["Réparation moteur", "Réparation embrayage", "Réparation freinage", "Réparation suspension"] },
    { type: "Pneus",            countRange: [1, 2],   amountRange: [100000, 180000],desc: ["Changement pneus avant", "Jeu de pneus complet", "Remplacement pneu"] },
    { type: "Assurance",        countRange: [1, 1],   amountRange: [100000, 150000],desc: ["Renouvellement assurance", "Assurance trimestrielle"] },
    { type: "Entretien",        countRange: [4, 6],   amountRange: [22000, 65000],  desc: ["Vidange périodique", "Révision moteur", "Filtres remplacés", "Contrôle technique"] },
    { type: "Pièces détachées", countRange: [1, 3],   amountRange: [25000, 140000], desc: ["Pièces détachées", "Remplacement pièce", "Plaquettes de frein"] },
    { type: "Lavage",           countRange: [8, 14],  amountRange: [3500, 12000],   desc: ["Lavage complet", "Nettoyage intérieur", "Polish carrosserie"] },
  ]
  const depenses = []
  for (const v of vehicules) {
    for (const cat of expenseCats) {
      const n = rnd(cat.countRange[0], cat.countRange[1])
      for (let i = 0; i < n; i++) {
        const d = addDays(baseDate, rnd(5, 184))
        depenses.push({
          id_depense: crypto.randomUUID(),
          date_depense: fmtDate(d),
          montant: rnd(cat.amountRange[0], cat.amountRange[1]),
          type_depense: cat.type,
          description: pick(cat.desc),
          id_vehicule: v.id_vehicule,
          immobilisation: false,
          date_debut_immobilisation: null,
          date_fin_immobilisation: null,
          created_at: fmtDT(addDays(d, rnd(0, 3))),
        })
      }
    }
  }
  // Scale uniforme pour atteindre 35% du CA total
  const totalCA = recettes.reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
  const targetDepenses = totalCA * 0.35
  const rawDepensesSum = depenses.reduce((s, d) => s + d.montant, 0)
  const scaleFactor = targetDepenses / rawDepensesSum
  for (const d of depenses) {
    d.montant = Math.max(500, Math.round((d.montant * scaleFactor) / 100) * 100)
  }
  const finalDepensesSum = depenses.reduce((s, d) => s + d.montant, 0)
  console.log(`   CA total      : ${Math.round(totalCA).toLocaleString("fr-FR")} FCFA`)
  console.log(`   Cible 35%     : ${Math.round(targetDepenses).toLocaleString("fr-FR")} FCFA`)
  console.log(`   Brut généré   : ${Math.round(rawDepensesSum).toLocaleString("fr-FR")} FCFA (× ${scaleFactor.toFixed(3)})`)
  console.log(`   Total final   : ${finalDepensesSum.toLocaleString("fr-FR")} FCFA (${(finalDepensesSum / totalCA * 100).toFixed(1)}% du CA)`)
  await insertChunks(supa, "depenses_vehicules", depenses)
  console.log(`   ✓ ${depenses.length} dépenses`)

  // 10) entretiens + tâches
  console.log("🔧 Entretiens et tâches…")
  const entretiens = []
  const taches = []
  for (const v of vehicules) {
    const n = rnd(3, 5)
    let ts = addDays(baseDate, rnd(10, 25))
    for (let i = 0; i < n; i++) {
      const dRealise = addDays(ts, i * rnd(28, 40))
      const id = crypto.randomUUID()
      entretiens.push({
        id,
        id_vehicule: v.id_vehicule,
        immatriculation: v.immatriculation,
        date_realise: fmtDate(dRealise),
        huile_moteur: true,
        filtre_huile: true,
        filtre_air: rnd(0, 1) === 1,
        filtre_pollen: rnd(0, 1) === 1,
        liquide_refroidissement: rnd(0, 1) === 1,
        huile_frein: rnd(0, 1) === 1,
        pneus: rnd(0, 1) === 1,
        km_vidange: Math.max(1000, (v.km_actuel || 100000) - rnd(2000, 22000)),
        cout: rnd(25000, 95000),
        technicien: pick(["Garage Koffi", "Atelier Nord", "Meca Pro", "Garage Yopougon"]),
        notes: "Entretien régulier planifié.",
        created_at: fmtDT(addDays(dRealise, 1)),
        // inspection laissée null : le widget EntretiensWidget attend la structure
        // complète (eclairage, carrosserie, interieur, mecanique, pneus, freinage,
        // documents, equipements). Un objet partiel fait crasher detectAlertes() en client-side.
        inspection: null,
      })
      const tCount = rnd(1, 3)
      for (let t = 0; t < tCount; t++) {
        taches.push({
          id: crypto.randomUUID(),
          id_vehicule: v.id_vehicule,
          immatriculation: v.immatriculation,
          description: pick(["Contrôle niveau huile", "Vérifier pression pneus", "Tester batterie", "Nettoyage intérieur", "Vérifier freins"]),
          fait: t === 0,
          id_entretien: id,
          created_at: fmtDT(addDays(dRealise, 1)),
          fait_at: t === 0 ? fmtDT(addDays(dRealise, 1)) : null,
        })
      }
    }
  }
  await insertChunks(supa, "entretiens", entretiens)
  console.log(`   ✓ ${entretiens.length} entretiens`)
  await insertChunks(supa, "taches_suivi", taches)
  console.log(`   ✓ ${taches.length} tâches`)

  // 11) versements clients (mensuels)
  console.log("🏦 Versements clients (mensuels)…")
  const versementsClients = []
  for (const c of clients) {
    for (let m = 0; m < 6; m++) {
      const month = addMonths(baseDate, m)
      versementsClients.push({
        id_client: c.id,
        mois: `${month.getUTCFullYear()}-${pad(month.getUTCMonth() + 1)}`,
        montant: rnd(120000, 220000),
        date_versement: fmtDate(addDays(month, rnd(20, 28))),
        notes: "Versement mensuel client.",
        created_at: fmtDT(addDays(month, rnd(20, 28))),
      })
    }
  }
  await insertChunks(supa, "versements_clients", versementsClients)
  console.log(`   ✓ ${versementsClients.length} versements clients`)

  // 12) versements chauffeurs (hebdo)
  console.log("💵 Versements chauffeurs (hebdo)…")
  const versementsChauf = []
  const weekStart = addDays(baseDate, 7 - baseDate.getUTCDay())
  for (let w = 0; w < 26; w++) {
    const payDate = addDays(weekStart, w * 7)
    for (const ch of activeChauffeurs) {
      const a = assignments.find((x) => x.id_chauffeur === ch.id_chauffeur && (!x.date_fin || new Date(x.date_fin) >= payDate))
      const vId = a ? a.id_vehicule : pick(activeVehicules).id_vehicule
      versementsChauf.push({
        date_versement: fmtDate(payDate),
        id_chauffeur: ch.id_chauffeur,
        id_vehicule: vId,
        // ~6 jours × 20k = 120k/sem (avec variation)
        montant: rnd(85000, 150000),
        created_at: fmtDT(addDays(payDate, 1)),
      })
    }
  }
  await insertChunks(supa, "versements_chauffeurs", versementsChauf)
  console.log(`   ✓ ${versementsChauf.length} versements chauffeurs`)

  // 13) attributions (mappées via id_recette local → id réel via "Identifiant de transaction")
  console.log("📊 Calcul des attributions…")
  // On a besoin d'un mapping local→réel pour id_recette. On utilise le champ id_recette qu'on a setté à 200000+localId : il devient l'id_recette en base ET correspond à r.id_recette dans le tableau JS — donc on peut l'utiliser tel quel.
  const vehiculesById = new Map(vehicules.map((v) => [v.id_vehicule, v]))
  const feriesMap = new Map(feriesData.map((f) => [f.date, Number(f.montant)]))
  const attribRows = buildAttributions(recettes, vehiculesById, feriesMap)
  // remplace _localId par id_recette qui correspond
  for (const a of attribRows) {
    a.id_recette = 200000 + a.id_recette
    a.montant_attribue = Math.round(a.montant_attribue)
  }
  await insertChunks(supa, "versement_attribution", attribRows)
  console.log(`   ✓ ${attribRows.length} attributions`)

  // 14) AI insights
  console.log("🧠 AI insights et alertes…")
  const insights = []
  for (let i = 0; i < 6; i++) {
    const d = addMonths(baseDate, i)
    insights.push({
      triggered_by: i === 0 ? "auto" : pick(["auto", "manual"]),
      created_at: fmtDT(addDays(d, rnd(2, 8))),
      analysis: { summary: `Analyse mensuelle de ${fmtDate(d)}`, revenue: rnd(1200000, 3200000), commandes_completes: rnd(800, 1200) },
      retard_vehicules: [{ immatriculation: pick(vehicules).immatriculation, jours_retard: rnd(1, 3) }],
      is_after_noon: rnd(0, 1) === 1,
      total_vehicules: vehicules.length,
    })
  }
  await insertChunks(supa, "ai_insights", insights)

  const alertes = []
  for (let i = 0; i < 18; i++) {
    const d = addDays(baseDate, rnd(20, 180))
    alertes.push({
      type_alerte: pick(["paiement", "retard", "maintenance", "vidange", "assurance"]),
      gravite: pick(["critique", "important", "opportunite"]),
      cible: pick(["chauffeur", "vehicule", "client"]),
      message_envoye: "Alerte automatique générée.",
      data_snapshot: { note: "Sample alert", immatriculation: pick(vehicules).immatriculation },
      statut: pick(["envoyee", "traitee", "ignoree"]),
      date_envoi: fmtDT(d),
      date_expiration: fmtDT(addDays(d, 3)),
    })
  }
  await insertChunks(supa, "alertes_envoyees", alertes)
  console.log(`   ✓ ${insights.length} insights + ${alertes.length} alertes`)

  // 15) summary
  console.log(`\n✅ Seed terminé pour le tenant '${tenant.slug}' (${tenant.nom})`)
  console.log(`   Total : ${clients.length} clients · ${vehicules.length} véhicules · ${chauffeurs.length} chauffeurs`)
  console.log(`   Période : ${fmtDate(baseDate)} → ${fmtDate(today)} (184 jours)`)
  console.log(`   Données : ${commandes.length} commandes · ${recettes.length} recettes · ${depenses.length} dépenses · ${entretiens.length} entretiens · ${attribRows.length} attributions`)
}

main().catch((err) => {
  console.error("\n❌ Erreur lors du seed :", err.message)
  process.exit(1)
})
