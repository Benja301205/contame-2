"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markCheckinSkipped, submitCheckin, type CheckinItemInput } from "@/lib/actions/checkins";
import { calculateCheckinTotal } from "@/lib/checkins/totals";
import { PROBLEM_CATEGORIES } from "@/lib/analysis/classify";
import { categoryLabel } from "@/lib/labels";
import { formatHumanDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CompensationType = { id: string; name: string; default_unit_cost: number };

export type ExistingCheckin = {
  status: "completed" | "skipped";
  items: Array<{ typeName: string; quantity: number; unitCost: number; total: number }>;
  total: number;
};

type Row = {
  typeId: string;
  typeName: string;
  enabled: boolean;
  quantity: number;
  unitCost: number;
  reasonCategory: string;
};

export function CheckinDayPanel({
  branchId,
  date,
  isToday,
  compensationTypes,
  existing,
  currency = "ARS",
}: {
  branchId: string;
  date: string;
  isToday: boolean;
  compensationTypes: CompensationType[];
  existing: ExistingCheckin | null;
  currency?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"summary" | "unanswered" | "wizard">(
    existing ? "summary" : "unanswered",
  );
  const [rows, setRows] = useState<Row[]>(
    compensationTypes.map((t) => ({
      typeId: t.id,
      typeName: t.name,
      enabled: false,
      quantity: 1,
      unitCost: t.default_unit_cost,
      reasonCategory: PROBLEM_CATEGORIES[0],
    })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(typeId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.typeId === typeId ? { ...r, ...patch } : r)));
  }

  async function handleNoCompensations() {
    setLoading(true);
    setError(null);
    const res = await submitCheckin(branchId, date, []);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleSkip() {
    setLoading(true);
    setError(null);
    const res = await markCheckinSkipped(branchId, date);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleSubmitWizard() {
    setLoading(true);
    setError(null);
    const items: CheckinItemInput[] = rows
      .filter((r) => r.enabled)
      .map((r) => ({
        typeId: r.typeId,
        quantity: r.quantity,
        unitCost: r.unitCost,
        reasonCategory: r.reasonCategory,
      }));
    const res = await submitCheckin(branchId, date, items);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const previewTotal = calculateCheckinTotal(
    rows.filter((r) => r.enabled).map((r) => ({ quantity: r.quantity, unitCost: r.unitCost })),
  );

  const testId = isToday ? "checkin-panel-today" : `checkin-panel-${date}`;
  const humanDate = formatHumanDate(date);

  if (mode === "summary" && existing) {
    return (
      <Card className="max-w-lg" data-testid={testId}>
        <CardHeader>
          <CardTitle>{humanDate}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {existing.status === "skipped" ? (
            <p className="text-sm text-muted-foreground">Marcado como sin datos.</p>
          ) : existing.items.length === 0 ? (
            <p className="text-sm">Sin compensaciones ese día.</p>
          ) : (
            <>
              {existing.items.map((item, i) => (
                <p key={i} className="text-sm">
                  {item.typeName}: {item.quantity} × {formatMoney(item.unitCost, currency)} ={" "}
                  {formatMoney(item.total, currency)}
                </p>
              ))}
              <p className="text-sm font-medium">Total: {formatMoney(existing.total, currency)}</p>
            </>
          )}
          {isToday && (
            <Button size="sm" variant="outline" onClick={() => setMode("unanswered")}>
              Editar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (mode === "unanswered") {
    return (
      <Card className="max-w-lg" data-testid={testId}>
        <CardHeader>
          <CardTitle>
            {isToday ? "¿Hoy diste compensaciones?" : `${humanDate}: ¿hubo compensaciones?`}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={handleNoCompensations} disabled={loading}>
            No
          </Button>
          <Button variant="outline" onClick={() => setMode("wizard")} disabled={loading}>
            Sí
          </Button>
          {!isToday && (
            <Button variant="outline" onClick={handleSkip} disabled={loading}>
              Sin datos
            </Button>
          )}
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg" data-testid={testId}>
      <CardHeader>
        <CardTitle>{humanDate}: cargar compensaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.typeId} className="space-y-2 border-b pb-3 last:border-0">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => updateRow(row.typeId, { enabled: e.target.checked })}
              />
              {row.typeName}
            </label>
            {row.enabled && (
              <div className="flex flex-wrap items-end gap-2 pl-6">
                <div className="space-y-1">
                  <label htmlFor={`quantity-${row.typeId}`} className="block text-xs text-muted-foreground">
                    Cantidad
                  </label>
                  <Input
                    id={`quantity-${row.typeId}`}
                    type="number"
                    min="0"
                    className="w-20"
                    value={row.quantity}
                    onChange={(e) => {
                      const quantity = Number(e.target.value);
                      const type = compensationTypes.find((t) => t.id === row.typeId)!;
                      updateRow(row.typeId, { quantity, unitCost: quantity * type.default_unit_cost });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`reason-${row.typeId}`} className="block text-xs text-muted-foreground">
                    Motivo
                  </label>
                  <select
                    id={`reason-${row.typeId}`}
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                    value={row.reasonCategory}
                    onChange={(e) => updateRow(row.typeId, { reasonCategory: e.target.value })}
                  >
                    {PROBLEM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor={`unitcost-${row.typeId}`} className="block text-xs text-muted-foreground">
                    Monto
                  </label>
                  <Input
                    id={`unitcost-${row.typeId}`}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-24"
                    value={row.unitCost}
                    onChange={(e) => updateRow(row.typeId, { unitCost: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <p className="text-sm font-medium">Total: {formatMoney(previewTotal, currency)}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={handleSubmitWizard} disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </Button>
          <Button variant="outline" onClick={() => setMode(existing ? "summary" : "unanswered")}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
