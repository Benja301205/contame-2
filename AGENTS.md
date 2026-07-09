# Contame 2 — MVP por loops (Ralph Loop)

## Regla de oro
Este proyecto se construye **loop por loop** siguiendo `PRD_Contame_MVP.md`. Antes de escribir cualquier código:

1. Leé la **sección 0** del PRD (instrucciones obligatorias).
2. Leé `PROGRESS.md` para saber en qué loop estamos.
3. Leé el loop actual completo en el PRD.

## Prohibiciones
- **No adelantar features de loops futuros**, ni "de paso".
- **No implementar nada de "Fuera de scope del MVP"** (sección 6 del PRD).
- No inventar datos, endpoints ni tablas que no estén en el PRD. Lo que no está definido, se pregunta.

## Definition of Done de cada loop
Criterios de aceptación cumplidos + tests del loop en verde + regresión de loops anteriores en verde + `npm run build` limpio. Al terminar: actualizar `PROGRESS.md`, **commitear y pushear** (un commit por loop; nunca incluir `.env*` ni `scratch/`), y **frenar a esperar confirmación humana** antes del siguiente loop.

## Correcciones dentro de un loop
Alcance limitado: corregir solo lo necesario para que el loop actual cumpla sus criterios. No refactorizar otras partes del sistema.
