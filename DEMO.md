# DEMO.md — Guión de demo (10 minutos)

Demo de "Pardo's Burgers", una cadena ficticia de 6 sucursales con 6 meses de reviews y 2 meses de check-ins, 100% sintéticos (sin llamar a Apify ni a Claude). El objetivo del guión: primero mostrar que Contame detecta qué problema se repite en cada sucursal, y cerrar mostrando cuánto plata le está costando eso al negocio — la pantalla de pérdidas es el cierre, no el heatmap.

## Setup (una vez, <5 min)

```bash
npm install
supabase start
npm run seed:demo
npm run build && npm run start   # o npm run dev
```

`npm run seed:demo` es idempotente: correrlo de nuevo no duplica nada.

**Credenciales:**
- Admin: `admin@pardosburgers.demo` / `Demo1234!`
- Gerente de Palermo (sucursal con patrón de demora): `manager.palermo@pardosburgers.demo` / `Demo1234!`

**Sucursales y su patrón dominante** (para saber qué esperar en cada pantalla):

| Sucursal | Problema dominante |
|---|---|
| Palermo | Demora |
| Belgrano | Atención |
| Recoleta | Calidad de comida |
| Caballito | Comida fría |
| Once | Limpieza |
| Flores | Precio |

## Guión (~10 min)

### 1. Login como admin (30 seg)
Entrar a `/login` con `admin@pardosburgers.demo`. Redirige al Dashboard.

### 2. Dashboard — "mirá qué se repite en cada sucursal" (3 min)
- Mostrar las tarjetas por sucursal: rating promedio, tendencia vs. período anterior, y el gráfico de "Top problemas" con 1-2 reviews de ejemplo citadas debajo.
- Cambiar el selector de período (30 / 90 / 180 días) para mostrar que el patrón se sostiene en el tiempo, no es ruido de una semana.
- Bajar hasta el heatmap sucursal × categoría: de un vistazo se ve que cada columna tiene "su" color fuerte — Palermo en demora, Recoleta en calidad de comida, etc. Este es el momento "ajá, cada sucursal tiene un problema distinto y lo podemos ver".

### 3. Detalle de sucursal — evidencia (2 min)
Entrar a "Ver detalle de sucursal" en **Palermo**.
- Evolución mensual de rating.
- Breakdown por severidad.
- Reviews críticas recientes (severidad 3) — texto real de la reseña, para que quede claro que no es una categoría abstracta sino quejas concretas de clientes.

### 4. Operación diaria — de dónde sale la plata real (1.5 min)
Salir (`Salir`) y volver a entrar como `manager.palermo@pardosburgers.demo`. Cae directo en `/checkin`.
- Mostrar el wizard: "¿Hoy diste compensaciones?" → Sí → tildar un tipo (ej. "Descuento"), completar cantidad/motivo/monto, Guardar.
- Señalar que el motivo (`Demora`) es el mismo problema que domina Palermo en el dashboard de patrones — no es casualidad, es la fuente de datos: las compensaciones que carga el gerente todos los días son las que alimentan la pérdida real.
- (Opcional, si hay tiempo) Achicar la ventana o abrir en el celular para mostrar que el check-in es usable en mobile — es la pantalla que un gerente completa parado en el local.

### 5. Cierre — pérdidas, real y estimada (2.5 min)
Salir y volver a entrar como admin. Ir al Dashboard (o al detalle de Palermo) y bajar hasta **"Pérdidas"**.
- **Pérdida real**: la suma de las compensaciones que los gerentes cargaron (lo que viste en el paso anterior, ahora agregado).
- **Pérdida estimada**: clientes que no vuelven por una mala experiencia, según reviews negativas × ticket promedio × factor de afectación configurado.
- Abrir el modal de **metodología** (ícono junto al título) para mostrar el cálculo de forma transparente — no es una caja negra.
- En el detalle de sucursal, mostrar la evolución mensual de ambas pérdidas y el breakdown por tipo de compensación / categoría de motivo.
- Cierre del pitch: "esto es lo que te está costando lo que vimos en el paso 2 — y ahora lo tenés con un número todos los meses."

## Qué NO mostrar (fuera de scope del MVP)
No hay recomendaciones automáticas, no hay integración con nómina/facturación, no hay alertas proactivas. Si preguntan, aclarar que es la base para eso, no que ya lo hace.

## Troubleshooting rápido
- Si el dashboard aparece vacío: correr `npm run seed:demo` de nuevo (es idempotente, no rompe nada).
- Si `/api/recompute-loss` da 429: hay un rate limit en memoria (ver `README.md`) — esperar unos segundos y reintentar.
