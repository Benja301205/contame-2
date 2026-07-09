"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

export function MethodologyModal({
  avgTicket,
  affectedFactor,
  currency = "ARS",
}: {
  avgTicket: number | null;
  affectedFactor: number;
  currency?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.showModal()}>
        ¿Cómo se calcula?
      </Button>
      <dialog
        ref={ref}
        className="modal-pop m-auto max-w-md rounded-lg border bg-popover p-6 text-sm text-popover-foreground shadow-lg backdrop:bg-black/50"
      >
        <h3 className="mb-3 font-medium">¿Cómo se calcula la pérdida?</h3>
        <p className="mb-2">
          <strong>Registrada por tus encargados:</strong> suma de las compensaciones que cada
          sucursal cargó en su registro diario (dato duro, no estimado).
        </p>
        <p className="mb-2">
          <strong>Estimada por reseñas negativas:</strong> cantidad de reseñas negativas del
          período × cuánto gasta un cliente promedio en una visita × cuántos clientes contamos
          como afectados por cada reseña.
        </p>
        <p className="mb-4 text-muted-foreground">
          Ticket promedio actual: {avgTicket != null ? formatMoney(avgTicket, currency) : "sin configurar"} ·
          Clientes afectados por reseña: {affectedFactor}
        </p>
        <Button type="button" size="sm" onClick={() => ref.current?.close()}>
          Cerrar
        </Button>
      </dialog>
    </>
  );
}
