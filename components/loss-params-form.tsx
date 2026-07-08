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
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="avgTicket">Ticket promedio</Label>
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
      <div className="space-y-2">
        <Label htmlFor="affectedFactor">Factor de clientes afectados</Label>
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
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
