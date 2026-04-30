/**
 * Wrapper minimal autour de l'API Management Supabase.
 * Doc : https://supabase.com/docs/reference/api/introduction
 *
 * Utilisé pour :
 *   - créer des projets clients programmatiquement
 *   - récupérer leurs API keys après création
 *   - exécuter du SQL (migration initiale) sur un projet fraîchement créé
 *
 * À utiliser UNIQUEMENT côté serveur (API routes). Le token a accès à
 * toute l'org Supabase.
 */

const API = "https://api.supabase.com/v1"

function token() {
  const t = process.env.SUPABASE_ACCESS_TOKEN
  if (!t) throw new Error("SUPABASE_ACCESS_TOKEN manquant")
  return t
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`Management API ${res.status} on ${path}: ${txt.slice(0, 300)}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export type SupabaseProject = {
  id:              string
  organization_id: string
  name:            string
  region:          string
  created_at:      string
  status:          "ACTIVE_HEALTHY" | "INACTIVE" | "INIT_FAILED" | "REMOVED" | "RESTORING" | "UPGRADING" | "PAUSING" | "RESTORE_FAILED" | "RESTARTING" | "COMING_UP" | "GOING_DOWN" | "PAUSED" | "PROVISIONING"
}

export type CreateProjectBody = {
  name:            string
  organization_id: string
  region:          string                    // ex: "eu-central-1"
  plan?:           "free" | "pro"
  db_pass:         string
}

export const supabaseManagement = {

  /** Crée un nouveau projet Supabase. Réponse contient l'id (= ref). */
  async createProject(body: CreateProjectBody): Promise<SupabaseProject> {
    return api<SupabaseProject>("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },

  /** Lit un projet (pour poller son status). */
  async getProject(ref: string): Promise<SupabaseProject> {
    return api<SupabaseProject>(`/projects/${ref}`)
  },

  /** Récupère les API keys (anon, service_role). */
  async getApiKeys(ref: string): Promise<{ name: string; api_key: string }[]> {
    return api(`/projects/${ref}/api-keys`)
  },

  /** Exécute du SQL arbitraire sur la base d'un projet. Renvoie les rows. */
  async runSql(ref: string, query: string): Promise<unknown[]> {
    return api(`/projects/${ref}/database/query`, {
      method: "POST",
      body: JSON.stringify({ query }),
    })
  },

  /** Attend que le projet passe en ACTIVE_HEALTHY. Timeout par défaut 5 min. */
  async waitUntilReady(ref: string, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<SupabaseProject> {
    const timeout  = opts.timeoutMs  ?? 5 * 60 * 1000
    const interval = opts.intervalMs ?? 5000
    const start    = Date.now()
    while (true) {
      const p = await this.getProject(ref)
      if (p.status === "ACTIVE_HEALTHY") return p
      if (p.status === "INIT_FAILED" || p.status === "RESTORE_FAILED") {
        throw new Error(`Project ${ref} en échec: ${p.status}`)
      }
      if (Date.now() - start > timeout) {
        throw new Error(`Timeout : projet ${ref} toujours en ${p.status} après ${timeout}ms`)
      }
      await new Promise(r => setTimeout(r, interval))
    }
  },
}
