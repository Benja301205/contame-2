"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

export function MethodologyModal({
  avgTicket,
  affectedFactor,
}: {
  avgTicket: number | null;
  affectedFactor: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.showModal()}>
        ¿Cómo se calcula?
      </Button>
      <dialog
        ref={ref}
        className="max-w-md rounded-lg border p-6 text-sm backdrop:bg-black/50"
      >
        <h3 className="mb-3 font-medium">¿Cómo se calcula la pérdida?</h3>
        <p className="mb-2">
          <strong>Pérdida real:</strong> suma de las compensaciones cargadas en el check-in
          diario de cada sucursal (dato duro, no estimado).
        </p>
        <p className="mb-2">
          <strong>Pérdida estimada por reviews:</strong> reviews negativas del período ×
          ticket promedio × factor de clientes afectados.
        </p>
        <p className="mb-4 text-muted-foreground">
          Ticket promedio actual: {avgTicket != null ? `$${avgTicket}` : "sin configurar"} ·
          Factor de clientes afectados: {affectedFactor}
        </p>
        <Button type="button" size="sm" onClick={() => ref.current?.close()}>
          Cerrar
        </Button>
      </dialog>
    </>
  );
}
