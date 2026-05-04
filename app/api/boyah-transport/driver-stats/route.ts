import { NextResponse } from "next/server"
import { getTenantAdmin } from "@/lib/supabaseTenant"

export const maxDuration = 30

type OrderRow = {
  status:     string
  created_at: string
  raw: {
    driver_profile?: { id?: string; name?: string }
    price?:          number | string
  }
}

// Récupère TOUTES les commandes avec pagination (contourne la limite Supabase de 1000 lignes)
async function fetchAllOrders(): Promise<OrderRow[]> {
  const supabase = await getTenantAdmin()
  const all: OrderRow[] = []
  const PAGE = 1000
  let from   = 0

  while (true) {
    const { data, error } = await supabase
      .from("commandes_yango")
      .select("status, created_at, raw")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1)

    if (error || !data || data.length === 0) break
    all.push(...(data as OrderRow[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

export async function GET() {
  const supabase = await getTenantAdmin()
  try {
    const now      = new Date()
    const weekAgo  = new Date(now.getTime() - 7  * 86400000)
    const monthAgo = new Date(now.getTime() - 30 * 86400000)

    // 1. Tous les orders depuis Supabase (colonnes top-level = types garantis)
    const orders = await fetchAllOrders()

    // 2. Profils drivers : on remplit TOUJOURS depuis la base locale d'abord
    // (fallback robuste). Si Yango est configuré ET que l'appel réussit, on
    // surcharge les profiles avec les données Yango (plus à jour : solde, statut,
    // photos). Cette stratégie garantit que la page affiche des données même si
    // Yango est down, mal configuré, ou pas configuré du tout.
    type Profile = { nom: string; telephone: string; vehicle: string; plaque: string; solde: string; statut: string }
    const profileMap = new Map<string, Profile>()

    // 2a. Base locale : matche les driver_profile.id seedés au format `driver-${id_chauffeur}`
    const [{ data: chauffeurs }, { data: affectations }, { data: vehicules }] = await Promise.all([
      supabase.from("chauffeurs").select("id_chauffeur, nom, numero_wave, actif"),
      supabase.from("affectation_chauffeurs_vehicules").select("id_chauffeur, id_vehicule, date_fin").is("date_fin", null),
      supabase.from("vehicules").select("id_vehicule, immatriculation, type_vehicule"),
    ])
    type V = { id_vehicule: number; immatriculation: string | null; type_vehicule: string | null }
    const vehById = new Map<number, V>((vehicules || []).map((v: V) => [v.id_vehicule, v]))
    const vehByChauffeur = new Map<number, V | undefined>(
      (affectations || []).map((a: { id_chauffeur: number; id_vehicule: number }) => [a.id_chauffeur, vehById.get(a.id_vehicule)])
    )
    for (const ch of (chauffeurs || []) as { id_chauffeur: number; nom: string | null; numero_wave: string | null; actif: boolean }[]) {
      const v = vehByChauffeur.get(ch.id_chauffeur)
      profileMap.set(`driver-${ch.id_chauffeur}`, {
        nom:       ch.nom || "",
        telephone: ch.numero_wave || "",
        vehicle:   v?.type_vehicule || "",
        plaque:    v?.immatriculation || "",
        solde:     "0",
        statut:    ch.actif ? "working" : "not_working",
      })
    }

    // 2b. Si Yango configuré, on tente de surcharger avec les données live.
    // En cas d'échec (env partiel, API down, réponse invalide), on conserve
    // simplement les profiles locaux — la page reste fonctionnelle.
    const driversUrl = process.env.YANGO_DRIVERS_URL
    const driversKey = process.env.YANGO_DRIVERS_API_KEY
    const clid       = process.env.CLID
    const parkId     = process.env.ID_DU_PARTENAIRE
    if (driversUrl && driversKey && clid && parkId) {
      try {
        const dRes = await fetch(driversUrl, {
          method: "POST",
          headers: {
            "Content-Type":    "application/json",
            "X-API-Key":       driversKey,
            "X-Client-ID":     clid,
            "X-Park-ID":       parkId,
            "Accept-Language": "fr",
          },
          body: JSON.stringify({ query: { park: { id: parkId } }, limit: 1000, offset: 0 }),
        })
        if (!dRes.ok) throw new Error(`Yango HTTP ${dRes.status}`)
        const dData = await dRes.json()
        type YangoProfile = {
          driver_profile?: { id?: string; first_name?: string; last_name?: string; phones?: string[]; work_status?: string }
          current_status?: { status?: string }
          car?: { brand?: string; model?: string; number?: string }
          accounts?: { balance?: string }[]
        }
        for (const d of (dData.driver_profiles ?? []) as YangoProfile[]) {
          const id = d.driver_profile?.id
          if (!id) continue
          profileMap.set(id, {
            nom:       `${d.driver_profile?.first_name || ""} ${d.driver_profile?.last_name || ""}`.trim(),
            telephone: d.driver_profile?.phones?.[0] || "",
            vehicle:   d.car ? `${d.car.brand} ${d.car.model}` : "",
            plaque:    d.car?.number || "",
            solde:     d.accounts?.[0]?.balance || "0",
            statut:    d.current_status?.status || "",
          })
        }
      } catch (e) {
        console.warn("[driver-stats] Yango fetch failed, using local fallback:", (e as Error).message)
      }
    }

    // 3. Agréger par driver_profile.id (clé fiable dans le raw Yango)
    type Bucket = {
      driverId:  string
      name:      string
      completed: { created_at: string; price: number }[]
      allCount:  number
    }
    const buckets = new Map<string, Bucket>()

    for (const row of orders) {
      const dp  = row.raw?.driver_profile
      const did = dp?.id?.trim() || ""
      if (!did) continue

      if (!buckets.has(did)) {
        buckets.set(did, { driverId: did, name: dp?.name || "", completed: [], allCount: 0 })
      }
      const b = buckets.get(did)!
      b.allCount++
      if (row.status === "complete") {
        b.completed.push({
          created_at: row.created_at,
          price:      Number(row.raw?.price || 0),
        })
      }
    }

    const COMMISSION = 0.025

    // 4. Construire stats finales
    const stats = []
    const seenIds = new Set<string>()

    for (const b of buckets.values()) {
      seenIds.add(b.driverId)
      const profile = profileMap.get(b.driverId)

      const totalRevenue = b.completed.reduce((s, o) => s + o.price, 0)
      const coursesWeek  = b.completed.filter(o => o.created_at && new Date(o.created_at) >= weekAgo).length
      const coursesMois  = b.completed.filter(o => o.created_at && new Date(o.created_at) >= monthAgo).length
      const sorted       = [...b.completed].sort((a, c) => new Date(c.created_at).getTime() - new Date(a.created_at).getTime())
      const lastActivity = sorted[0]?.created_at || null

      const status =
        coursesWeek > 0 ? "actif" :
        coursesMois > 0 ? "risque" : "inactif"

      stats.push({
        id:           b.driverId,
        nom:          profile?.nom          || b.name,
        telephone:    profile?.telephone    || "",
        vehicle:      profile?.vehicle      || "",
        plaque:       profile?.plaque       || "",
        solde:        profile?.solde        || "0",
        statut:       profile?.statut       || "",
        totalCourses: b.completed.length,
        totalRevenue: Math.round(totalRevenue),
        commission:   Math.round(totalRevenue * COMMISSION),
        lastActivity,
        status,
        coursesWeek,
        coursesMois,
      })
    }

    // Drivers enregistrés dans Yango mais sans aucune commande
    for (const [id, profile] of profileMap.entries()) {
      if (!seenIds.has(id)) {
        stats.push({
          id, ...profile,
          totalCourses: 0, totalRevenue: 0, commission: 0,
          lastActivity: null, status: "inactif",
          coursesWeek: 0, coursesMois: 0,
        })
      }
    }

    stats.sort((a, b) => b.totalRevenue - a.totalRevenue)

    return NextResponse.json({ ok: true, stats, total: stats.length })
  } catch (err) {
    console.error("[driver-stats]", err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
