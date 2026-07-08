"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BranchActionResult } from "@/lib/actions/branches";

type Branch = {
  name: string;
  address: string | null;
  google_place_id: string;
};

export function BranchForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prev: BranchActionResult, formData: FormData) => Promise<BranchActionResult>;
  defaultValues?: Branch;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required defaultValue={defaultValues?.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" defaultValue={defaultValues?.address ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="googlePlaceId">Google Place ID</Label>
        <Input
          id="googlePlaceId"
          name="googlePlaceId"
          required
          defaultValue={defaultValues?.google_place_id}
        />
        <p className="text-xs text-muted-foreground">
          Buscá tu sucursal en{" "}
          <a
            className="underline"
            href="https://developers.google.com/maps/documentation/places/web-service/place-id"
            target="_blank"
            rel="noreferrer"
          >
            este buscador de Place ID
          </a>{" "}
          y pegá el código acá.
        </p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
