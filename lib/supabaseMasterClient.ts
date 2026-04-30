"use client"

import { createClient } from "@supabase/supabase-js"

/**
 * Client navigateur pour la base MASTER (pour le login admin SaaS).
 * Utilise l'anon key — donc soumis à RLS de la base master.
 *
 * À utiliser UNIQUEMENT dans les pages /saas/* côté client.
 */

const url = process.env.NEXT_PUBLIC_MASTER_SUPABASE_URL || ""
const anon = process.env.NEXT_PUBLIC_MASTER_SUPABASE_ANON_KEY || ""

export const supabaseMasterClient = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "saas-admin-auth",  // distinct du storageKey tenant pour pas mélanger les sessions
  },
})
