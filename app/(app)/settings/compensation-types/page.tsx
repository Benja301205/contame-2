import { createClient } from "@/lib/supabase/server";
import { CompensationTypeRow } from "@/components/compensation-type-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CompensationTypesPage() {
  const supabase = await createClient();
  const { data: types } = await supabase
    .from("compensation_types")
    .select("id, name, default_unit_cost")
    .order("name");

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold">Tipos de compensación</h1>
      <Card>
        <CardHeader>
          <CardTitle>Costo unitario default</CardTitle>
        </CardHeader>
        <CardContent>
          {(types ?? []).map((t) => (
            <CompensationTypeRow
              key={t.id}
              id={t.id}
              name={t.name}
              defaultUnitCost={t.default_unit_cost}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
