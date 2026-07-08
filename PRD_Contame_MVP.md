# PRD — Contame MVP
## Documento de desarrollo por loops (metodología Ralph Loop) para Claude Code

**Versión:** 1.0 · **Fecha:** 2026-07-07 · **Autor:** Guillermo + Claude (PM/Arquitecto)

---

## 0. INSTRUCCIONES PARA CLAUDE CODE (leer antes de escribir código)

Este documento se ejecuta **loop por loop**. Reglas obligatorias:

1. **Un loop a la vez.** No escribas código de un loop futuro, ni "de paso" adelantes features.
2. **Definition of Done por loop:** todos los criterios de aceptación cumplidos + todos los tests del loop en verde + `npm run build` sin errores + demo manual verificable en el browser.
3. Al terminar un loop, actualizá el archivo `PROGRESS.md` en la raíz del repo con: loop completado, fecha, decisiones tomadas, deuda técnica detectada. Luego **detenete y pedí confirmación humana** antes de arrancar el siguiente loop.
4. Si un criterio de aceptación no se puede cumplir tal como está escrito, **no lo saltees**: documentá el bloqueo en `PROGRESS.md` y preguntá.
5. Si encontrás un bug de un loop anterior, arreglalo antes de seguir. Los loops anteriores siempre deben seguir funcionando (correr sus tests como regresión).
6. No inventes datos ni endpoints. Todo lo que no esté definido acá se pregunta.
7. Mantené el scope: lo listado en "Fuera de scope del MVP" está prohibido implementarlo aunque parezca fácil.

---

## 1. CONTEXTO Y PROBLEMA

**Contame** ayuda a cadenas gastronómicas a escuchar a sus clientes. Los dueños de cadenas no saben:
- qué problemas se repiten en cada sucursal (demoras, comida fría, mala atención),
- cuánta plata pierden por mala experiencia: descuentos, postres bonificados, devoluciones y otras compensaciones que los gerentes otorgan y nadie contabiliza.

**Propuesta de valor del MVP:** ingerir Google Reviews por sucursal, analizarlas con LLM para detectar patrones de problemas, capturar diariamente las compensaciones que otorga cada gerente, y mostrar en un dashboard la **pérdida económica cuantificada** por sucursal y por causa.

## 2. USUARIOS Y ROLES

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| `admin` | Dueño / gerencia central de la cadena | Ve todas las sucursales, dashboard consolidado, configura sucursales y usuarios, ve pérdidas y patrones. |
| `manager` | Gerente de sucursal | Ve solo su(s) sucursal(es). Completa el check-in diario de compensaciones. Ve reviews y análisis de su sucursal. |

- Multi-tenant desde el día 1: cada usuario pertenece a una `organization` (cadena). Aislamiento por **RLS de Supabase**.
- Sin auto-registro público: el admin invita a los gerentes por email (Supabase Auth invite).

## 3. STACK Y ARQUITECTURA

- **Framework:** Next.js 14+ (App Router, TypeScript) — front y API routes en un solo repo.
- **Backend/DB/Auth:** Supabase (Postgres + Auth + RLS). Cliente `@supabase/ssr`.
- **Análisis de texto:** Claude API (`claude-haiku` o superior) vía API route del servidor. La key **nunca** va al cliente.
- **Ingesta de reviews:** API de terceros (Outscraper o SerpAPI — decidir por costo en Loop 2; abstraer detrás de una interfaz `ReviewProvider` para poder cambiar de proveedor).
- **UI:** Tailwind + shadcn/ui. Gráficos con Recharts.
- **Tests:** Vitest (unit/integration) + Playwright (e2e smoke por loop).
- **Idioma de la UI:** español (Argentina). **Moneda:** configurable por organización (default ARS).

Estructura sugerida del repo:

```
/app
  /(auth)/login
  /(app)/dashboard        # admin
  /(app)/branches
  /(app)/branches/[id]
  /(app)/checkin          # gerente
  /(app)/reviews
  /(app)/settings
  /api/sync-reviews
  /api/analyze
/lib
  /supabase (clients, types)
  /providers/reviews.ts   # interfaz ReviewProvider + impl Outscraper/SerpAPI
  /analysis/classify.ts   # prompts + parseo de salida del LLM
  /loss/engine.ts         # motor de cuantificación de pérdidas
/supabase/migrations
/tests
PROGRESS.md
```

## 4. PANTALLAS DEL MVP

1. **Login** (email + password, invitaciones por email).
2. **Dashboard admin:** KPIs de la cadena, ranking de sucursales por pérdida $, top categorías de problemas, tendencia de rating.
3. **Detalle de sucursal:** rating y su evolución, reviews analizadas, patrones detectados, pérdidas $ desglosadas (compensaciones reales + pérdida estimada por reviews).
4. **Reviews:** lista filtrable (sucursal, sentimiento, categoría, severidad, fecha) con la clasificación del LLM visible.
5. **Check-in diario (gerente):** cuestionario guiado de compensaciones del día.
6. **Configuración (admin):** sucursales (alta con Google Place ID), usuarios/invitaciones, tipos de compensación y costos unitarios promedio, moneda.

## 5. FLUJOS PRINCIPALES

**F1 — Ingesta y análisis de reviews:** cron/manual → `ReviewProvider` trae reviews nuevas por sucursal → dedupe → se guardan `pending` → job de análisis llama a Claude API en lote → guarda sentimiento, categorías, severidad y flag de compensación mencionada.

> **Cambio de scope aprobado (post-Loop 2, 2026-07-07):** "manual" acá ya no significa que el admin del cliente dispare la sync desde la UI. Las operaciones que consumen APIs pagas (sync de reviews con Apify; en el Loop 3, análisis con Claude API) quedan reguladas exclusivamente por el equipo de Contame — vía cron (Vercel) o herramientas internas (`scripts/sync.ts`, autenticadas con `CRON_SECRET`), nunca por acción directa del admin. Motivo: control de costos de APIs pagas durante el MVP. Ver detalle en PROGRESS.md (resumen del Loop 2).

**F2 — Check-in diario del gerente:** el gerente entra (o recibe recordatorio) → responde el cuestionario del día: cantidad y motivo de descuentos, postres/bebidas bonificadas, devoluciones, platos rehechos, otros → se registran ítems con monto (real o estimado por costo unitario configurado).

**F3 — Cuantificación de pérdidas:** motor que suma por sucursal/mes: (a) compensaciones reales del check-in, (b) pérdida estimada por reviews negativas (modelo simple y transparente, ver Loop 6). Ambas se muestran siempre separadas y con su método visible.

**F4 — Detección de patrones:** agregación de categorías del análisis LLM por sucursal/período → "Top problemas" con frecuencia, tendencia y ejemplos de reviews.

## 6. RESTRICCIONES Y FUERA DE SCOPE DEL MVP

**Restricciones:** presupuesto de APIs bajo (batch + cache de análisis; no re-analizar reviews ya procesadas), sin app mobile (web responsive), sin notificaciones push (solo email opcional en Loop 7), español únicamente.

**Fuera de scope (prohibido en MVP):** respuestas automáticas a reviews, integración POS, otras fuentes (TripAdvisor, encuestas propias), facturación/billing del SaaS, reportes PDF, análisis de fotos, benchmarking entre cadenas.

## 7. CRITERIOS DE ÉXITO DEL MVP

1. **Patrones accionables:** el sistema detecta ≥3 patrones de problemas por sucursal con ejemplos reales que deriven en acciones del cliente.
2. **Pérdida $ cuantificada:** número de pérdida mensual por sucursal, desglosado y con metodología visible, que el cliente considere creíble.
3. **Demo vendible:** con datos seed realistas, la app se puede demostrar de punta a punta a un prospecto en <10 minutos.

## 8. MODELO DE DATOS COMPLETO (referencia)

Cada loop crea solo las tablas que necesita; esta es la vista final.

```sql
organizations   (id uuid PK, name, currency text default 'ARS', created_at)
profiles        (id uuid PK = auth.users.id, org_id FK, full_name, role text check in ('admin','manager'), created_at)
branches        (id uuid PK, org_id FK, name, address, google_place_id text unique, is_active bool, created_at)
branch_managers (branch_id FK, profile_id FK, PK compuesta)  -- un gerente puede tener 1+ sucursales
reviews         (id uuid PK, org_id FK, branch_id FK, provider_review_id text, author_name, rating int 1-5,
                 text, review_date date, fetched_at, analysis_status text check in ('pending','done','failed'),
                 unique(branch_id, provider_review_id))
review_analysis (review_id PK/FK, sentiment text check in ('positive','neutral','negative'),
                 categories text[],            -- valores del catálogo de categorías
                 severity int check 1-3,       -- 1 leve, 2 media, 3 crítica
                 mentions_compensation bool, summary text, model text, analyzed_at)
compensation_types (id uuid PK, org_id FK, name, default_unit_cost numeric, is_active bool)
                 -- seed por org: descuento, postre bonificado, bebida bonificada, devolución, plato rehecho, otro
checkins        (id uuid PK, org_id FK, branch_id FK, manager_id FK, checkin_date date,
                 status text check in ('pending','completed','skipped'), completed_at,
                 unique(branch_id, checkin_date))
compensation_items (id uuid PK, checkin_id FK, type_id FK, quantity int, unit_cost numeric,
                 total numeric generated, reason_category text, note text)
sync_jobs       (id uuid PK, org_id FK, branch_id FK, kind text check in ('fetch','analyze'),
                 status, started_at, finished_at, stats jsonb, error text)
loss_snapshots  (id uuid PK, org_id FK, branch_id FK, period date (mes),
                 compensation_total numeric, estimated_review_loss numeric,
                 method jsonb, computed_at)    -- cache mensual del motor de pérdidas
```

**Catálogo de categorías de problemas (fijo en MVP):** `demora`, `atencion`, `calidad_comida`, `comida_fria`, `limpieza`, `precio`, `pedido_incorrecto`, `ambiente`, `otro`.

**RLS (aplica a todas las tablas):** `org_id = (select org_id from profiles where id = auth.uid())`. Además, `manager` solo lee/escribe filas de sucursales presentes en `branch_managers`.

---

# LOOPS DE DESARROLLO

> Regla transversal: **no avanzar al siguiente loop hasta que el actual cumpla su Definition of Done** (criterios de aceptación + tests en verde + build limpio + regresión de loops anteriores).

---

## LOOP 0 — Fundaciones: proyecto, auth y multi-tenancy

**Objetivo:** app deployable con login, organizaciones, roles y RLS funcionando. Es la base de seguridad: si esto está mal, todo lo demás filtra datos entre cadenas.

**Funcionalidades**
- Scaffold Next.js + TypeScript + Tailwind + shadcn/ui + Supabase (local con CLI y migraciones versionadas).
- Auth email/password. Layout con navegación según rol. Página de login y logout.
- Seed script: 2 organizaciones de prueba, 1 admin y 1 manager por org.
- Middleware de protección de rutas: no autenticado → `/login`; manager no accede a `/settings` ni al dashboard consolidado.

**Archivos/Componentes sugeridos**
- `supabase/migrations/0001_core.sql` (organizations, profiles + RLS + trigger de perfil al crear usuario)
- `lib/supabase/{client,server,middleware}.ts`, `middleware.ts`
- `app/(auth)/login/page.tsx`, `app/(app)/layout.tsx`, `components/nav.tsx`
- `scripts/seed.ts`, `PROGRESS.md`

**Modelo de datos:** `organizations`, `profiles` (con RLS activas).

**Criterios de aceptación**
1. Un usuario puede loguearse y ver su nombre, rol y organización.
2. Un usuario de la org A no puede leer filas de la org B ni siquiera consultando Supabase directo con su JWT (verificado por test de RLS).
3. Un `manager` que navega a `/settings` es redirigido.
4. `npm run build` y el deploy local (`npm run dev`) funcionan sin warnings críticos.

**Tests básicos**
- Unit: helper de sesión/rol.
- Integration (contra Supabase local): RLS — usuario org A no lee profiles de org B.
- E2E (Playwright): login exitoso, login fallido, redirect de rutas protegidas.

**⛔ No avanzar al Loop 1 hasta que este loop funcione por completo (criterios + tests en verde).**

---

## LOOP 1 — Sucursales y gestión de usuarios

**Objetivo:** el admin administra sucursales y gerentes; el sistema sabe qué Google Place ID corresponde a cada sucursal (prerequisito de la ingesta).

**Funcionalidades**
- CRUD de sucursales (admin): nombre, dirección, `google_place_id` (input manual con instrucciones de cómo obtenerlo), activa/inactiva.
- Invitación de gerentes por email (Supabase invite) y asignación de sucursales a gerentes.
- Vista "Mis sucursales" para el manager (solo las suyas).
- Settings: moneda de la organización; catálogo `compensation_types` con costo unitario default editable (seed automático al crear org).

**Archivos/Componentes sugeridos**
- `supabase/migrations/0002_branches.sql` (branches, branch_managers, compensation_types + RLS)
- `app/(app)/branches/page.tsx`, `app/(app)/branches/[id]/edit.tsx`
- `app/(app)/settings/{page,users,compensation-types}.tsx`
- `app/api/invite/route.ts` (usa service role en servidor)

**Modelo de datos:** `branches`, `branch_managers`, `compensation_types`.

**Criterios de aceptación**
1. Admin crea, edita y desactiva sucursales; `google_place_id` es único por org.
2. Admin invita a un gerente, este recibe el mail, setea contraseña y al entrar ve solo sus sucursales asignadas.
3. Manager no puede crear/editar sucursales ni ver las no asignadas (UI y RLS).
4. Los tipos de compensación default existen para toda org nueva y el admin puede editar costos unitarios.

**Tests básicos**
- Integration RLS: manager lee solo branches asignadas; manager no puede insertar branches.
- Unit: validación de formulario de sucursal (place_id requerido y único).
- E2E: flujo admin crea sucursal → asigna manager → manager la ve.

**⛔ No avanzar al Loop 2 hasta que este loop funcione por completo.**

---

## LOOP 2 — Ingesta de Google Reviews

**Objetivo:** reviews reales de cada sucursal guardadas en la base, sin duplicados, con sincronización manual y programada.

**Funcionalidades**
- Interfaz `ReviewProvider` (`fetchReviews(placeId, since?): ProviderReview[]`) con una implementación concreta (Outscraper o SerpAPI, decidir por costo/latencia y documentar en PROGRESS.md) + una implementación `MockProvider` con fixtures para desarrollo y tests.
- Endpoint `POST /api/sync-reviews` (server-only, valida rol admin o cron secret): trae reviews por sucursal activa, dedupe por `(branch_id, provider_review_id)`, inserta como `analysis_status='pending'`.
- Botón "Sincronizar ahora" por sucursal (admin) + cron (Vercel Cron o `pg_cron`) cada 24 h.
- Registro de cada corrida en `sync_jobs` (cuántas trajo, cuántas nuevas, errores).
- Pantalla Reviews: lista con filtros por sucursal, rating y fecha (sin análisis todavía).

**Archivos/Componentes sugeridos**
- `supabase/migrations/0003_reviews.sql` (reviews, sync_jobs + RLS)
- `lib/providers/reviews.ts` (+ `outscraper.ts` o `serpapi.ts`, `mock.ts`, fixtures JSON)
- `app/api/sync-reviews/route.ts`, `vercel.json` (cron)
- `app/(app)/reviews/page.tsx`

**Modelo de datos:** `reviews`, `sync_jobs`.

**Criterios de aceptación**
1. Con el MockProvider, una sync inserta las reviews de fixture y una segunda corrida inserta 0 duplicados.
2. Con el provider real y un `google_place_id` válido, se traen reviews reales de al menos una sucursal de prueba.
3. Cada corrida queda registrada en `sync_jobs` con stats correctas; los errores del provider no rompen la corrida de otras sucursales.
4. La pantalla Reviews muestra las reviews con filtros funcionando; manager solo ve las de sus sucursales.

**Tests básicos**
- Unit: dedupe y mapeo provider → schema interno.
- Integration: sync con MockProvider (inserción + idempotencia); RLS de reviews.
- E2E: admin dispara sync y ve reviews nuevas en la lista.

**⛔ No avanzar al Loop 3 hasta que este loop funcione por completo.**

---

## LOOP 3 — Análisis de reviews con Claude API

**Objetivo:** cada review queda clasificada: sentimiento, categorías de problema (catálogo fijo), severidad, mención de compensación y resumen de una línea.

**Funcionalidades**
- `lib/analysis/classify.ts`: prompt con salida JSON estricta (usar tool use / JSON schema), catálogo de categorías cerrado, batch de hasta N reviews por llamada para bajar costo.
- Job `POST /api/analyze` (server-only): toma reviews `pending`, llama a Claude, guarda en `review_analysis`, marca `done`/`failed` con retry simple (máx 2). Se dispara automáticamente al final de cada sync y también manualmente.
- Nunca re-analizar reviews `done` (control de costo).
- Pantalla Reviews enriquecida: chips de sentimiento/categorías/severidad, filtros por estos campos.

**Archivos/Componentes sugeridos**
- `supabase/migrations/0004_analysis.sql` (review_analysis + RLS)
- `lib/analysis/classify.ts` (prompt versionado + parser con validación zod)
- `app/api/analyze/route.ts`
- `components/review-card.tsx`

**Modelo de datos:** `review_analysis`.

**Criterios de aceptación**
1. Corrido el job sobre 20+ reviews de fixture, ≥95% termina `done` con JSON válido; las `failed` quedan marcadas y son re-procesables.
2. Clasificaciones coherentes en un set dorado de 15 reviews escritas a mano (esperado vs. obtenido: sentimiento correcto en ≥13/15, categoría principal correcta en ≥12/15).
3. Reviews ya analizadas nunca se reenvían al LLM.
4. Filtros por sentimiento/categoría/severidad funcionan en la pantalla Reviews.

**Tests básicos**
- Unit: parser/validador de la respuesta del LLM (casos: JSON válido, malformado, categoría fuera de catálogo).
- Integration: job con LLM mockeado (marca estados correctamente, respeta batch, no re-analiza).
- Set dorado: script `scripts/eval-classifier.ts` que corre las 15 reviews contra la API real y reporta aciertos.

**⛔ No avanzar al Loop 4 hasta que este loop funcione por completo.**

---

## LOOP 4 — Check-in diario de compensaciones (gerente)

**Objetivo:** capturar todos los días, con mínima fricción, las compensaciones que otorgó cada sucursal: qué, cuántas, por qué motivo y cuánto costaron.

**Funcionalidades**
- Al entrar el manager, la home es el check-in del día: "¿Hoy diste compensaciones?" → No (registra `completed` vacío) / Sí → wizard por tipo: cantidad, motivo (mismo catálogo de categorías de problemas), monto (prellenado con `quantity × default_unit_cost`, editable).
- Un check-in por sucursal por día (`unique(branch_id, checkin_date)`); editable solo el mismo día.
- Días pendientes: banner con hasta 7 días hacia atrás para completar retroactivamente (estado `pending` visible para el admin como "sin datos", nunca como cero).
- Vista admin: calendario/tabla de cumplimiento de check-ins por sucursal.

**Archivos/Componentes sugeridos**
- `supabase/migrations/0005_checkins.sql` (checkins, compensation_items + RLS)
- `app/(app)/checkin/page.tsx` (wizard), `components/checkin-wizard.tsx`
- `app/(app)/dashboard/compliance.tsx` (vista admin de cumplimiento)
- `lib/checkins/backfill.ts` (generación de días pendientes)

**Modelo de datos:** `checkins`, `compensation_items`.

**Criterios de aceptación**
1. Manager completa el check-in del día en <2 minutos (wizard sin pantallas muertas); "sin compensaciones" es un solo tap.
2. Imposible crear dos check-ins misma sucursal/día (constraint + UI).
3. Totales calculados correctamente (`quantity × unit_cost` editable, suma por check-in).
4. Admin distingue claramente "día sin compensaciones" (0) de "día sin datos" (pending/skipped).
5. Manager solo puede cargar check-ins de sus sucursales (RLS).

**Tests básicos**
- Unit: cálculo de totales, generación de días pendientes.
- Integration: constraint de unicidad, RLS de checkins/items.
- E2E: manager completa wizard con 2 tipos de compensación y los totales aparecen.

**⛔ No avanzar al Loop 5 hasta que este loop funcione por completo.**

---

## LOOP 5 — Dashboard de patrones por sucursal

**Objetivo:** el admin ve, de un vistazo, qué problemas se repiten en cada sucursal y cómo evolucionan. Acá se cumple el criterio de éxito "patrones accionables".

**Funcionalidades**
- Dashboard admin: rating promedio y tendencia por sucursal (últimos 90 días), distribución de sentimiento, **Top 5 problemas por sucursal** (categoría, frecuencia, tendencia vs. período anterior, 2 reviews de ejemplo).
- Detalle de sucursal: evolución mensual de rating y volumen, breakdown por categoría y severidad, reviews críticas recientes (severidad 3).
- Comparador simple: tabla de sucursales × categorías (heatmap) para detectar problemas localizados vs. sistémicos.
- Filtro de período global (30/90/180 días).

**Archivos/Componentes sugeridos**
- `supabase/migrations/0006_views.sql` (vistas o funciones SQL de agregación: `branch_category_stats`, `branch_rating_trend`)
- `app/(app)/dashboard/page.tsx`, `app/(app)/branches/[id]/page.tsx`
- `components/charts/{trend-chart,heatmap,category-bar}.tsx` (Recharts)

**Modelo de datos:** solo vistas/funciones de agregación sobre tablas existentes (sin tablas nuevas).

**Criterios de aceptación**
1. Con el seed de demo, el dashboard muestra ≥3 patrones distinguibles por sucursal (ej.: sucursal A domina `demora`, B domina `atencion`).
2. Los números de las agregaciones coinciden con queries SQL manuales de control (test de consistencia).
3. Heatmap sucursal × categoría legible con 10 sucursales y 9 categorías.
4. Todo filtro de período recalcula correctamente; carga del dashboard <2 s con 5.000 reviews seed.

**Tests básicos**
- Integration: vistas SQL devuelven agregados correctos sobre un dataset fixture conocido.
- Unit: transformación de datos para los charts.
- E2E: dashboard renderiza con seed y el filtro de período cambia los valores.

**⛔ No avanzar al Loop 6 hasta que este loop funcione por completo.**

---

## LOOP 6 — Motor de cuantificación de pérdidas $

**Objetivo:** mostrar la pérdida económica mensual por sucursal con metodología transparente. Acá se cumple el criterio de éxito "pérdida $ cuantificada".

**Funcionalidades**
- `lib/loss/engine.ts` con dos componentes **siempre separados en la UI**:
  - **Pérdida real:** suma de `compensation_items` del período (dato duro del check-in).
  - **Pérdida estimada por reviews:** modelo simple y explicable: `reviews negativas del período × ticket promedio configurable × factor de clientes afectados configurable` (defaults conservadores: factor 1, es decir solo el autor de la review). Parámetros editables en Settings con explicación de la fórmula en la UI.
- `loss_snapshots` mensual (cache, recalculable) para performance y consistencia histórica.
- Sección "Pérdidas" en dashboard y detalle de sucursal: total mensual, desglose real vs. estimado, breakdown por tipo de compensación y por categoría de motivo, evolución mensual.
- Tooltip/modal "¿Cómo se calcula?" con la fórmula y los parámetros usados (credibilidad = transparencia).

**Archivos/Componentes sugeridos**
- `supabase/migrations/0007_loss.sql` (loss_snapshots + parámetros en organizations: `avg_ticket`, `affected_factor`)
- `lib/loss/engine.ts`, `app/api/recompute-loss/route.ts` (cron mensual + manual)
- `components/loss/{loss-summary,loss-breakdown,methodology-modal}.tsx`

**Modelo de datos:** `loss_snapshots` + columnas de parámetros en `organizations`.

**Criterios de aceptación**
1. Para un mes con datos fixture conocidos, el motor devuelve exactamente los valores calculados a mano (test con números cerrados).
2. Pérdida real y estimada nunca aparecen sumadas sin desglose; la metodología es visible en un click.
3. Cambiar `avg_ticket` o `affected_factor` en Settings y recalcular actualiza los snapshots.
4. El ranking de sucursales por pérdida del dashboard coincide con los snapshots.

**Tests básicos**
- Unit: motor de pérdidas con dataset fixture (casos: mes sin check-ins, mes sin reviews, mes completo).
- Integration: recompute idempotente (correr 2 veces no duplica snapshots).
- E2E: admin cambia parámetros → recalcula → el dashboard refleja el cambio.

**⛔ No avanzar al Loop 7 hasta que este loop funcione por completo.**

---

## LOOP 7 — Pulido, seed de demo y hardening

**Objetivo:** cumplir el criterio "demo vendible": la app se demuestra de punta a punta en <10 minutos con datos realistas, sin errores visibles.

**Funcionalidades**
- Seed de demo realista: 1 cadena ("Pardo's Burgers", 6 sucursales), ~1.500 reviews distribuidas en 6 meses con patrones intencionales por sucursal, 60 días de check-ins con compensaciones coherentes con las reviews.
- Estados vacíos y de error en todas las pantallas (org nueva sin datos, sync fallida, análisis pendiente).
- Loading states/skeletons; revisión responsive (el gerente carga el check-in desde el celular).
- Hardening: rate limit en endpoints de API, validación zod en todas las rutas, revisión final de RLS (test suite completa como regresión), variables de entorno documentadas en `README.md`.
- Guión de demo en `DEMO.md` (paso a paso de 10 minutos).

**Archivos/Componentes sugeridos**
- `scripts/seed-demo.ts`, `DEMO.md`, `README.md`
- `components/empty-states/*.tsx`
- Ajustes transversales (no hay features nuevas).

**Modelo de datos:** sin cambios.

**Criterios de aceptación**
1. `npm run seed:demo` deja la app lista para demo en un entorno limpio en <5 minutos.
2. Recorrido completo del guión de DEMO.md sin errores de consola ni pantallas rotas.
3. Suite completa de tests (loops 0–7) en verde; Lighthouse accesibilidad ≥90 en dashboard y check-in.
4. Check-in usable en viewport mobile (375 px).

**Tests básicos**
- E2E completo: guión de demo automatizado en Playwright (login admin → dashboard → sucursal → pérdidas → login manager → check-in).
- Regresión: toda la suite anterior.

**⛔ Fin del MVP original. Todo lo que sigue es una extensión explícita aprobada por el dueño del producto — ver Loop 8.**

---

## Loop 8 — Rediseño UX/UI (extensión aprobada, post-MVP)

**Motivo:** el MVP funcionaba pero estaba pensado para quien lo construyó, no para quien lo va a usar. Audiencia objetivo real: dueños y gerentes gastronómicos **no técnicos**. Principios rectores: cero jerga, cero datos crudos (slugs, ISO dates), la plata primero, y cada pantalla responde una pregunta del usuario sin que tenga que interpretar nada.

**Regla de alcance:** UI/copy/estilos únicamente. No se tocaron migraciones, el motor de pérdidas (`lib/loss/engine.ts`), el clasificador (`lib/analysis/classify.ts`) ni la lógica de los endpoints — solo cómo se presentan sus resultados.

**Qué se hizo:**
1. **Bug real encontrado y arreglado:** la card "Distribución de sentimiento" del dashboard colapsaba a ~32px porque `<Card className="w-fit">` envolvía un `ResponsiveContainer width="100%"` de Recharts — un padre `w-fit` sin contenido propio colapsa a 0 antes de que el chart mida. Fix: `w-full max-w-md`. Test nuevo (`tests/e2e/dashboard.spec.ts`) que mide `getBoundingClientRect()` del chart renderizado, no solo presencia de texto — el tipo de test que sí atrapa este bug.
2. **Tipografía:** `app/globals.css` tenía `--font-sans: var(--font-sans)` (autorreferencial, nunca resolvía a la fuente real inyectada por `next/font`) — por eso el sitio renderizaba con el serif default del navegador pese a tener Geist configurado en `layout.tsx`. Fix: `--font-sans: var(--font-geist-sans)`.
3. **Tema de marca:** verde de Contame (`#166534`, contraste 7.13:1 con blanco) como `--primary` (botones, links, foco, estados activos del nav); verde-lima (`#65a30d`) como acento de gráficos (`lib/theme.ts`, `CHART_ACCENT`, reemplaza el azul default de Recharts). Fondo de página gris muy claro (`oklch(0.97 0.004 247)`) para que las cards blancas se despeguen visualmente.
4. **`lib/labels.ts`:** diccionario central de categorías (`comida_fria` → "Comida fría", etc.), severidad (1/2/3 → "Menor"/"Importante"/"Grave" con semáforo de color) y sentimiento — usado en charts, heatmap, filtros, chips y ejemplos. Ningún slug con guión bajo llega a la UI. Test que recorre todo `PROBLEM_CATEGORIES` y falla si algún label queda sin traducir.
5. **`lib/format.ts`:** `formatMoney` (Intl.NumberFormat es-AR, `"$ 12.400"` con símbolo, punto de miles y espacio no separable — sin decimales), `formatRating` (`"2,1 de 5"`, coma decimal), `formatHumanDate` (`"Hoy, miércoles 8 de julio"` si es hoy en hora argentina, `"8 jul 2026"` en cualquier otro caso — nunca una fecha ISO cruda) y `formatShortDayMonth` para encabezados de tabla.
6. **Panel** (renombre de "Dashboard", el admin aterriza acá directo — `/` ahora es un simple redirect según rol, sin pantalla de cuenta intermedia): orden rediseñado — (a) héroe de pérdidas del mes arriba de todo (`"Este mes tu cadena perdió $X"`, única pantalla que suma real + estimada, siempre con desglose debajo — decisión explícita del dueño del producto que reemplaza la regla más estricta del Loop 6 solo en esta pantalla), sucursales ordenadas de mayor a menor pérdida con barra comparativa (`components/loss/loss-ranking-bars.tsx`); (b) veredicto en una frase por sucursal generado por reglas sin LLM (`lib/dashboard/verdict.ts`: categoría dominante + tendencia, ej. "Atención es el problema dominante y empeoró vs. el período anterior"); (c) charts. Ratings con estrellas dibujadas + `"2,1 de 5"`; cambio de rating en 0 muestra `"sin cambios"` en gris, nunca una flecha roja/verde en cero.
7. **Reseñas** (renombre de "Reviews"): contador arriba (`"214 reseñas · 78 negativas"`), filtros esenciales (Sucursal, Sentimiento) siempre visibles y el resto (Rating, Problema, Gravedad, fechas) colapsado en un `<details>` "Más filtros" (se abre solo si alguno de esos filtros ya está activo). Chips y opciones de filtro traducidos.
8. **Registro del día** (renombre de "Check-in"): estado binario arriba de cada sucursal (`"✓ Ya cargaste las compensaciones de hoy"` / `"Te falta cargar el día de hoy"`), fecha humana, días pendientes como `"Te faltan N días anteriores"` con la lista debajo (no solo el estado de hoy). Motivo de compensación traducido, montos con `formatMoney`.
9. **Configuración:** ayuda inline en criollo para Ticket promedio (`"¿Cuánto gasta un cliente promedio en una visita?"`) y Factor de clientes afectados (`"1 = contamos solo al cliente que escribió la reseña — la estimación más conservadora"`); feedback visible al guardar (`"✓ Guardado"`, antes no había ninguna confirmación); texto de ayuda de `google_place_id` reescrito en lenguaje llano; fix de labels pegados a inputs/selects (`currency-form.tsx` no tenía `block` en el label — mismo bug de spacing que ya se había encontrado y arreglado en el Loop 7 para el wizard de check-in, esta vez en Configuración y en los filtros de Reseñas).
10. **Heatmap → "Problemas por sucursal"**, columnas con categorías traducidas.
11. Detalle de sucursal: labels de pérdidas alineados con el Panel, gravedad traducida, fechas ISO crudas reemplazadas por `formatShortDayMonth`, moneda de la org pasada a todos los componentes de plata.

**Bug de contraste encontrado y corregido en el camino (no pedido explícitamente, pero necesario para mantener el criterio de Lighthouse):** el nuevo fondo de página gris claro bajó el contraste de `--muted-foreground` (heredado del Loop 7, ya quedaba anotado como deuda técnica en 96/100) por debajo de 4.5:1 en texto que no está dentro de una card blanca — se oscureció a `#666666`. Las flechas de tendencia (`text-emerald-600`/`text-red-600`, contraste 3.65:1 con blanco) se oscurecieron a `-700`. Resultado: Lighthouse accesibilidad pasó de 96/100 (Panel) y 95/100 (Registro del día) a **100/100 en ambas pantallas**, contra el build de producción.

**Suite:** 124 unit/integration (Vitest) + 13 e2e (Playwright) en verde — se sumaron tests nuevos (`format.test.ts`, `labels.test.ts`, `dashboard-verdict.test.ts`, la medición de dimensiones del chart) y se ajustaron los textos esperados en los tests existentes al nuevo copy (nav, dashboard, loss, checkin-wizard), sin tocar la lógica que verifican. `npm run build` sin errores ni warnings nuevos.

**⛔ Cualquier feature nueva a partir de acá requiere un PRD nuevo o una extensión explícita de este documento.**

---

## ANEXO A — Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # solo servidor
ANTHROPIC_API_KEY                # solo servidor
REVIEWS_PROVIDER=outscraper|serpapi|mock
REVIEWS_PROVIDER_API_KEY
CRON_SECRET
```

## ANEXO B — Prompt base del clasificador (Loop 3, versionar en código)

Entrada: lote de reviews `{id, rating, text}`. Salida JSON por review:
`{review_id, sentiment: positive|neutral|negative, categories: [catálogo cerrado], severity: 1|2|3, mentions_compensation: bool, summary: string ≤120 chars}`.
Reglas: si el texto está vacío, clasificar solo por rating (1-2 negativo, 3 neutral, 4-5 positivo) con `categories: []`. Nunca inventar categorías fuera del catálogo. Responder únicamente JSON válido.

## ANEXO C — Orden de ejecución para Claude Code

```
Loop 0 → Loop 1 → Loop 2 → Loop 3 → Loop 4 → Loop 5 → Loop 6 → Loop 7
```

Después de cada loop: tests en verde → actualizar PROGRESS.md → **frenar y pedir confirmación** → recién ahí continuar.
