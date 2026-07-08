"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateCurrency, type OrgActionResult } from "@/lib/actions/organization";
import { CURRENCIES } from "@/lib/currencies";

export function CurrencyForm({ currentCurrency }: { currentCurrency: string }) {
  const [state, formAction, pending] = useActionState<OrgActionResult, FormData>(
    updateCurrency,
    {},
  );

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="currency" className="block text-sm font-medium">
          Moneda
        </label>
        <select
          id="currency"
          name="currency"
          defaultValue={currentCurrency}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
      {state.success && <p className="text-sm text-emerald-700">✓ Guardado</p>}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
