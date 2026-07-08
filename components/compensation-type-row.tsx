"use client";

import { useState } from "react";
import { updateCompensationTypeCost } from "@/lib/actions/compensation-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CompensationTypeRow({
  id,
  name,
  defaultUnitCost,
}: {
  id: string;
  name: string;
  defaultUnitCost: number;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        await updateCompensationTypeCost(id, formData);
        setPending(false);
      }}
      className="flex items-center justify-between gap-4 border-b py-2 last:border-0"
    >
      <span className="text-sm">{name}</span>
      <div className="flex items-center gap-2">
        <Input
          name="defaultUnitCost"
          type="number"
          min="0"
          step="0.01"
          defaultValue={defaultUnitCost}
          className="w-28"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
