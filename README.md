# vtc-saas

Plateforme SaaS multi-tenant dérivée de `vtc-dashboard`. Chaque client a sa propre base Supabase vierge, provisionnée depuis la tour de contrôle.

## Statut

Fork initial du codebase `vtc-dashboard` au 2026-04-30. Refactor multi-tenant en cours.

## Stack

Next.js 15 App Router · TypeScript · Supabase · Tailwind CSS

## Setup local

```bash
npm install
cp .env.local.example .env.local   # à créer — voir section Environnement
npm run dev
```

## Environnement

Variables requises dans `.env.local` (à créer) :

- `NEXT_PUBLIC_SUPABASE_URL` — projet Supabase de DEV (pas la prod)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Yango/Wave : optionnels, à définir par tenant
