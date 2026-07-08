# Contame

Dashboard para cadenas de restaurantes: reviews de Google, patrones de reclamos por sucursal y pérdida financiera estimada (compensaciones reales + churn estimado por reviews negativas).

Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS) + Tailwind/shadcn.

## Setup local

```bash
npm install
supabase start          # levanta Postgres local + Auth
npm run seed             # datos base de desarrollo (org/branches/usuarios de test)
npm run dev
```

Para una demo completa con datos realistas (sin tocar Apify ni Claude):

```bash
npm run seed:demo
```

## Variables de entorno

Crear `.env.local` (nunca commitear) con:

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (local o cloud). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase, usada en clientes browser/SSR con sesión de usuario. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key, solo server-side (`lib/supabase/admin.ts`, seeds, endpoints CRON_SECRET). Nunca exponer al cliente. |
| `NEXT_PUBLIC_SITE_URL` | Base URL de la app, usada para el `redirectTo` del flujo de invitación por email. |
| `CRON_SECRET` | Secreto compartido para autorizar `/api/sync-reviews`, `/api/analyze`, `/api/recompute-loss` (cron de Vercel y `scripts/sync.ts`). Sin este valor seteado, esos endpoints rechazan todo. |
| `APIFY_TOKEN` | Token de Apify para el `ApifyProvider` de reviews. Solo necesario si `REVIEW_PROVIDER=apify`. |
| `ANTHROPIC_API_KEY` | API key de Claude para `/api/analyze` (clasificación de reviews). |
| `REVIEW_PROVIDER` | `apify` usa el actor real de Apify; cualquier otro valor (o ausente) usa el `MockProvider` (útil en desarrollo/CI sin gastar créditos). |

## Rate limiting

Los endpoints `/api/sync-reviews`, `/api/analyze`, `/api/recompute-loss` (CRON_SECRET) y `/api/invite` (sesión de admin) tienen un rate limit simple en memoria (`lib/rate-limit.ts`).

**Importante:** en Vercel (serverless) el estado vive por instancia de función, no es un contador global — es un límite *best-effort*, no una garantía dura. Alcanza para el MVP (frenar retries en loop o abuso accidental de invitaciones). Si en algún momento se necesita un límite real y compartido entre instancias, migrar a Upstash/Redis — no vale la pena antes de que importe de verdad.

## Cron jobs (`vercel.json`)

- `06:00` diario — `/api/sync-reviews` (Apify, todas las orgs).
- `06:15` diario — `/api/analyze` (Claude, reviews pendientes).
- `1° de cada mes, 05:00` — `/api/recompute-loss` (recalcula snapshots de pérdida de todas las orgs).

## Documentación del proyecto

- `PRD_Contame_MVP.md` — alcance y loops del MVP.
- `PROGRESS.md` — estado de avance loop por loop.
- `DEMO.md` — guión de demo de 10 minutos.
- `CLAUDE.md` — reglas de desarrollo por loops (Ralph Loop).
