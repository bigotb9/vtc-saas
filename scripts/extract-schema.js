/**
 * Extraction du schéma d'un projet Supabase via l'API Management.
 *
 * Usage :
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx \
 *   SUPABASE_PROJECT_REF=xxxxxx \
 *   OUT_FILE=supabase/migrations/0001_initial.sql \
 *   node scripts/extract-schema.js
 *
 * Le résultat est un fichier SQL idempotent à rejouer sur une base vierge
 * lors du provisioning d'un nouveau tenant.
 */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF   = process.env.SUPABASE_PROJECT_REF || 'iixpsfsqyfnllggvsvfl';
const OUT   = process.env.OUT_FILE || path.join(process.cwd(), 'supabase/migrations/0001_initial.sql');

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN manquant. Génère un token sur https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

// Tables non-VTC (résidus d'autres projets sur la même base) à exclure
const EXCLUDE_TABLES = [
  'users', 'payments', 'matches', 'match_stats',
  'messages', 'message_reads', 'message_targets',
  'support_tickets', 'boyahbot_memory', 'records_flotte',
  'calendrier', 'chauffeurs_yango_snapshot', 'entretiens_vehicules',
];
const EX_LIST = EXCLUDE_TABLES.map(t => `'${t}'`).join(', ');

async function sql(query, attempt = 1) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  }).catch(e => ({ ok: false, status: 0, _err: e.message }));
  if (res.ok === false && res._err) {
    if (attempt <= 3) { await new Promise(r => setTimeout(r, attempt * 1500)); return sql(query, attempt + 1); }
    throw new Error(`Network: ${res._err}`);
  }
  if (!res.ok) {
    const txt = await res.text();
    if ((res.status === 503 || res.status === 504 || res.status === 429) && attempt <= 4) {
      console.log(`  retry ${attempt} after ${res.status}…`);
      await new Promise(r => setTimeout(r, attempt * 2000));
      return sql(query, attempt + 1);
    }
    throw new Error(`HTTP ${res.status} on "${query.slice(0, 60)}…" → ${txt.slice(0, 200)}`);
  }
  return await res.json();
}

async function main() {
  console.log('Probing API...');
  const ping = await sql(`SELECT current_database() AS db, current_user AS u`);
  console.log('Connected:', ping[0]);

  let out = `-- ============================================================
-- Schéma initial VTC SaaS
-- Généré automatiquement depuis le projet de prod
-- Source: ${REF}.supabase.co (schéma public)
-- Date: ${new Date().toISOString()}
--
-- À rejouer sur chaque nouvelle base client (vide).
-- ============================================================

`;

  console.log('1/9 sequences');
  // Exclure les sequences appartenant aux tables exclues
  const seqs = await sql(`
    SELECT c.relname AS name,
      pg_catalog.format_type(s.seqtypid, NULL) AS data_type,
      s.seqstart::text AS start, s.seqincrement::text AS inc,
      s.seqmin::text AS minv, s.seqmax::text AS maxv,
      s.seqcache::text AS cache, s.seqcycle AS cyc
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_sequence s ON s.seqrelid = c.oid
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        JOIN pg_class ct ON ct.oid = d.refobjid
        WHERE d.objid = c.oid AND d.deptype = 'a'
          AND ct.relname IN (${EX_LIST})
      )
    ORDER BY c.relname
  `);
  if (seqs.length) {
    out += '-- ────────── Sequences ──────────\n\n';
    for (const s of seqs) {
      out += `CREATE SEQUENCE IF NOT EXISTS public."${s.name}" AS ${s.data_type}\n`;
      out += `  START WITH ${s.start} INCREMENT BY ${s.inc}\n`;
      out += `  MINVALUE ${s.minv} MAXVALUE ${s.maxv}\n`;
      out += `  CACHE ${s.cache} ${s.cyc ? 'CYCLE' : 'NO CYCLE'};\n\n`;
    }
  }

  console.log('2/9 tables (single batched query)');
  // Une seule requête qui ramène toutes les colonnes de toutes les tables
  const colsAll = await sql(`
    SELECT
      c.relname AS tab, c.oid::text AS oid, a.attnum AS pos,
      a.attname AS col,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
      a.attnotnull AS not_null,
      pg_get_expr(d.adbin, d.adrelid) AS def,
      a.attidentity AS ident,
      a.attgenerated::text AS generated
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN (${EX_LIST})
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
  `);
  // Une seule requête pour TOUTES les contraintes (PK, UNIQUE, CHECK, FK)
  // Pour les FK, on exclut UNIQUEMENT celles qui pointent vers une table public.X exclue.
  // Les FK vers auth.users (Supabase Auth) restent intactes.
  const consAll = await sql(`
    SELECT
      cl.relname AS tab,
      con.conname AS name,
      con.contype AS typ,
      pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    LEFT JOIN pg_class refcl ON refcl.oid = con.confrelid
    LEFT JOIN pg_namespace refnsp ON refnsp.oid = refcl.relnamespace
    WHERE n.nspname = 'public'
      AND cl.relname NOT IN (${EX_LIST})
      AND (
        con.contype != 'f'
        OR NOT (refnsp.nspname = 'public' AND refcl.relname IN (${EX_LIST}))
      )
    ORDER BY cl.relname, con.contype, con.conname
  `);

  // Grouper par table
  const colsByTab = new Map();
  for (const c of colsAll) {
    if (!colsByTab.has(c.tab)) colsByTab.set(c.tab, []);
    colsByTab.get(c.tab).push(c);
  }
  const consByTab = new Map();
  for (const c of consAll) {
    if (!consByTab.has(c.tab)) consByTab.set(c.tab, []);
    consByTab.get(c.tab).push(c);
  }

  out += '-- ────────── Tables ──────────\n\n';
  const tableNames = [...colsByTab.keys()].sort();
  for (const name of tableNames) {
    out += emitTable(name, colsByTab.get(name), consByTab.get(name) || []);
    out += '\n';
  }

  console.log('3/9 sequence ownership');
  const owns = await sql(`
    SELECT cs.relname AS seq_name, ct.relname AS tab_name, a.attname AS col_name
    FROM pg_class cs
    JOIN pg_depend d ON d.objid = cs.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
    JOIN pg_class ct ON ct.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = ct.oid AND a.attnum = d.refobjsubid
    JOIN pg_namespace n ON n.oid = cs.relnamespace
    WHERE n.nspname = 'public' AND cs.relkind = 'S'
      AND ct.relname NOT IN (${EX_LIST})
    ORDER BY cs.relname
  `);
  if (owns.length) {
    out += '-- ────────── Sequence ownership ──────────\n\n';
    for (const o of owns) {
      out += `ALTER SEQUENCE public."${o.seq_name}" OWNED BY public."${o.tab_name}"."${o.col_name}";\n`;
    }
    out += '\n';
  }

  console.log('4/9 foreign keys (post-tables)');
  const fks = consAll.filter(c => c.typ === 'f');
  if (fks.length) {
    out += '-- ────────── Foreign keys ──────────\n\n';
    for (const fk of fks) {
      out += `ALTER TABLE public."${fk.tab}" ADD CONSTRAINT "${fk.name}" ${fk.def};\n`;
    }
    out += '\n';
  }

  console.log('5/9 indexes');
  const idx = await sql(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename NOT IN (${EX_LIST})
      AND indexname NOT IN (
        SELECT conname FROM pg_constraint
        WHERE contype IN ('p','u') AND connamespace = 'public'::regnamespace
      )
    ORDER BY tablename, indexname
  `);
  if (idx.length) {
    out += '-- ────────── Indexes ──────────\n\n';
    for (const i of idx) out += `${i.indexdef};\n`;
    out += '\n';
  }

  console.log('6/9 functions');
  const fns = await sql(`
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
    ORDER BY p.proname
  `);
  if (fns.length) {
    out += '-- ────────── Functions ──────────\n\n';
    for (const f of fns) out += `${f.def};\n\n`;
  }

  console.log('7/9 views (with topo order)');
  // Récupère TOUTES les vues, on filtre ensuite côté JS celles qui référencent une table exclue
  const allViews = await sql(`
    SELECT c.oid::text AS oid, c.relname AS name, c.relkind AS kind, pg_get_viewdef(c.oid, true) AS def
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
    ORDER BY c.oid
  `);
  // Filtre : exclure les vues qui référencent une table exclue dans leur définition SQL
  const exRegex = new RegExp(`\\b(${EXCLUDE_TABLES.join('|')})\\b`, 'i');
  const views = allViews.filter(v => !exRegex.test(v.def));
  if (allViews.length !== views.length) {
    const skipped = allViews.filter(v => exRegex.test(v.def)).map(v => v.name);
    console.log('   skipped views referencing excluded tables:', skipped.join(', '));
  }
  let depsRes = [];
  if (views.length) {
    depsRes = await sql(`
      SELECT DISTINCT r.ev_class::text AS view_oid, d.refobjid::text AS dep_oid
      FROM pg_rewrite r
      JOIN pg_depend d ON d.objid = r.oid AND d.deptype = 'n'
      JOIN pg_class c ON c.oid = r.ev_class
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('v','m')
        AND d.refobjid IN (SELECT oid FROM pg_class WHERE relkind IN ('v','m'))
        AND r.ev_class != d.refobjid
    `);
  }
  const depMap = new Map(views.map(v => [v.oid, new Set()]));
  for (const r of depsRes) {
    if (depMap.has(r.view_oid) && depMap.has(r.dep_oid)) depMap.get(r.view_oid).add(r.dep_oid);
  }
  const ordered = [];
  const visited = new Set();
  function visit(oid) {
    if (visited.has(oid)) return;
    visited.add(oid);
    for (const dep of depMap.get(oid) || []) visit(dep);
    ordered.push(oid);
  }
  for (const v of views) visit(v.oid);
  if (views.length) {
    const byOid = new Map(views.map(v => [v.oid, v]));
    out += '-- ────────── Views ──────────\n\n';
    for (const oid of ordered) {
      const v = byOid.get(oid);
      const kind = v.kind === 'm' ? 'MATERIALIZED VIEW' : 'VIEW';
      out += `CREATE OR REPLACE ${kind} public."${v.name}" AS\n${v.def}\n\n`;
    }
  }

  console.log('8/9 triggers');
  const trigs = await sql(`
    SELECT t.tgname AS name, c.relname AS tab, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
      AND c.relname NOT IN (${EX_LIST})
    ORDER BY c.relname, t.tgname
  `);
  if (trigs.length) {
    out += '-- ────────── Triggers ──────────\n\n';
    for (const t of trigs) out += `${t.def};\n`;
    out += '\n';
  }

  console.log('9/9 RLS + policies');
  const rls = await sql(`
    SELECT c.relname AS name FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
      AND c.relname NOT IN (${EX_LIST})
    ORDER BY c.relname
  `);
  if (rls.length) {
    out += '-- ────────── Row Level Security ──────────\n\n';
    for (const r of rls) out += `ALTER TABLE public."${r.name}" ENABLE ROW LEVEL SECURITY;\n`;
    out += '\n';
  }
  const pols = await sql(`SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename NOT IN (${EX_LIST}) ORDER BY tablename, policyname`);
  if (pols.length) {
    out += '-- ────────── Policies ──────────\n\n';
    for (const p of pols) {
      let s = `CREATE POLICY "${p.policyname}" ON public."${p.tablename}"`;
      if (p.permissive === 'RESTRICTIVE') s += ' AS RESTRICTIVE';
      if (p.cmd && p.cmd !== 'ALL') s += ` FOR ${p.cmd}`;
      const roles = Array.isArray(p.roles) ? p.roles : (typeof p.roles === 'string' ? p.roles.replace(/^\{|\}$/g, '').split(',').filter(Boolean) : []);
      if (roles.length > 0) s += ` TO ${roles.join(', ')}`;
      if (p.qual) s += ` USING (${p.qual})`;
      if (p.with_check) s += ` WITH CHECK (${p.with_check})`;
      out += `${s};\n`;
    }
    out += '\n';
  }

  // ────── Grants Supabase (toujours inclus) ──────
  // Sans ces GRANT, les rôles `anon` et `authenticated` n'ont aucun droit
  // sur les tables, et même une policy RLS valide est rejetée avec
  // "permission denied for table X". Indispensable.
  out += '-- ────────── Grants Supabase (anon, authenticated, service_role) ──────────\n\n';
  out += 'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;\n';
  out += 'GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;\n';
  out += 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;\n';
  out += 'GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;\n';
  out += 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;\n';
  out += 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;\n';
  out += 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES  TO anon, authenticated, service_role;\n';

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log('---');
  console.log('Written:', OUT);
  console.log('Lines :', out.split('\n').length);
  console.log('Size  :', (out.length / 1024).toFixed(1), 'KB');
  console.log('Counts: seq', seqs.length, '· tables', tableNames.length, '· fks', fks.length, '· indexes', idx.length, '· fns', fns.length, '· views', views.length, '· trigs', trigs.length, '· rls', rls.length, '· pols', pols.length);
}

function emitTable(name, cols, cons) {
  const pks   = cons.filter(c => c.typ === 'p');
  const uniqs = cons.filter(c => c.typ === 'u');
  const chks  = cons.filter(c => c.typ === 'c');
  let s = `CREATE TABLE public."${name}" (\n`;
  const lines = [];
  for (const c of cols) {
    let l = `  "${c.col}" ${c.type}`;
    if (c.ident === 'a')           l += ' GENERATED ALWAYS AS IDENTITY';
    else if (c.ident === 'd')      l += ' GENERATED BY DEFAULT AS IDENTITY';
    else if (c.generated === 's')  l += ` GENERATED ALWAYS AS (${c.def}) STORED`;
    else if (c.def)                l += ` DEFAULT ${c.def}`;
    if (c.not_null)                 l += ' NOT NULL';
    lines.push(l);
  }
  for (const r of pks)   lines.push(`  CONSTRAINT "${r.name}" ${r.def}`);
  for (const r of uniqs) lines.push(`  CONSTRAINT "${r.name}" ${r.def}`);
  for (const r of chks)  lines.push(`  CONSTRAINT "${r.name}" ${r.def}`);
  s += lines.join(',\n') + '\n);\n';
  return s;
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
