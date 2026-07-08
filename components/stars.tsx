/**
 * Estrellas dibujadas a partir de un rating 1-5 (redondeado al entero más
 * cercano para el dibujo). El texto real del rating (con coma decimal) va
 * al lado como texto visible — acá solo el ícono, oculto a lectores de
 * pantalla para no duplicar el anuncio.
 */
export function Stars({ rating }: { rating: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-hidden="true" className="text-amber-500">
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}
