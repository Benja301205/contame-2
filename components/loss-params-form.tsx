"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLossParams } from "@/lib/actions/organization";
import type { OrgActionResult } from "@/lib/actions/organization";

export function LossParamsForm({
  avgTicket,
  affectedFactor,
}: {
  avgTicket: number | null;
  affectedFactor: number;
}) {
  const [state, formAction, pending] = useActionState<OrgActionResult, FormData>(
    updateLossParams,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="avgTicket">Ticket promedio</Label>
        <p className="text-xs text-muted-foreground">
          ¿Cuánto gasta un cliente promedio en una visita?
        </p>
        <Input
          id="avgTicket"
          name="avgTicket"
          type="number"
          min="0"
          step="0.01"
          placeholder="Sin configurar"
          defaultValue={avgTicket ?? ""}
          className="w-36"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="affectedFactor">Factor de clientes afectados</Label>
        <p className="text-xs text-muted-foreground">
          1 = contamos solo al cliente que escribió la reseña — la estimación más conservadora.
        </p>
        <Input
          id="affectedFactor"
          name="affectedFactor"
          type="number"
          min="0"
          step="0.1"
          defaultValue={affectedFactor}
          className="w-36"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        {state.success && <p className="text-sm text-emerald-700">✓ Guardado</p>}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}
