# DEMO.md — Guión de demo (10 minutos)

Demo de "Pardo's Burgers", una cadena ficticia de 6 sucursales con 6 meses de reseñas y 2 meses de registros diarios, 100% sintéticos (sin llamar a Apify ni a Claude). El objetivo del guión: mostrar primero cuánta plata le está costando el problema (el Panel abre con eso), y después la evidencia de por qué — qué problema se repite en cada sucursal.

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
Entrar a `/login` con `admin@pardosburgers.demo`. Redirige directo al **Panel**.

### 2. Panel — la plata primero (3 min)
Lo primero que se ve, arriba de todo, es el número: **"Este mes tu cadena perdió $X"**, con el desglose debajo (registrado por encargados vs. estimado por reseñas negativas) y las sucursales ordenadas de mayor a menor pérdida con barra comparativa.
- Abrir **"¿Cómo se calcula?"** para mostrar la metodología de forma transparente — no es una caja negra.
- Bajar hasta las tarjetas por sucursal: rating con estrellas, el veredicto en una frase ("Demora es el problema dominante y empeoró vs. el período anterior") y el gráfico de problemas más frecuentes con reseñas de ejemplo citadas debajo.
- Cambiar el selector de período (30 / 90 / 180 días) para mostrar que el patrón se sostiene en el tiempo, no es ruido de una semana.
- Bajar hasta **"Problemas por sucursal"**: de un vistazo se ve que cada columna tiene "su" color fuerte — Palermo en demora, Recoleta en calidad de comida, etc.

### 3. Detalle de sucursal — evidencia (2 min)
Entrar a "Ver detalle de sucursal" en **Palermo**.
- Evolución mensual de rating.
- Breakdown por gravedad.
- Reseñas más graves recientes — texto real de la reseña, para que quede claro que no es una categoría abstracta sino quejas concretas de clientes.

### 4. Registro del día — de dónde sale la plata real (1.5 min)
Salir (`Salir`) y volver a entrar como `manager.palermo@pardosburgers.demo`. Cae directo en el **Registro del día**, con la fecha de hoy y el estado bien claro ("Te falta cargar el día de hoy" o "✓ Ya cargaste las compensaciones de hoy").
- Mostrar el wizard: "¿Hoy diste compensaciones?" → Sí → tildar un tipo (ej. "Descuento"), completar cantidad/motivo/monto, Guardar.
- Señalar que el motivo (Demora) es el mismo problema que domina Palermo en el Panel — no es casualidad, es la fuente de datos: las compensaciones que carga el gerente todos los días son las que alimentan la pérdida registrada.
- (Opcional, si hay tiempo) Achicar la ventana o abrir en el celular para mostrar que el registro es usable en mobile — es la pantalla que un gerente completa parado en el local.

### 5. Cierre — volver al Panel (2.5 min)
Salir y volver a entrar como admin. El Panel abre otra vez directo en el número de pérdidas del mes — ese es el cierre del pitch: "esto es lo que te está costando lo que acabás de ver en el paso 4, agregado, con un número todos los meses."

## Qué NO mostrar (fuera de scope del MVP)
No hay recomendaciones automáticas, no hay integración con nómina/facturación, no hay alertas proactivas. Si preguntan, aclarar que es la base para eso, no que ya lo hace.

## Troubleshooting rápido
- Si el Panel aparece vacío: correr `npm run seed:demo` de nuevo (es idempotente, no rompe nada).
- Si `/api/recompute-loss` da 429: hay un rate limit en memoria (ver `README.md`) — esperar unos segundos y reintentar.
