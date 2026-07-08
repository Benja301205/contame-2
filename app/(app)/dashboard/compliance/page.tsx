import { createClient } from "@/lib/supabase/server";
import { todayInBuenosAires } from "@/lib/checkins/today";
import { formatMoney, formatShortDayMonth } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function lastNDays(today: string, n: number): string[] {
  const days: string[] = [];
  const base = new Date(`${today}T00:00:00Z`);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default async function CompliancePage() {
  const supabase = await createClient();
  const today = todayInBuenosAires();
  const days = lastNDays(today, 7);

  const { data: organization } = await supabase.from("organizations").select("currency").single();
  const currency = organization?.currency ?? "ARS";

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: checkins } = await supabase
    .from("checkins")
    .select("branch_id, checkin_date, status, compensation_items(total)")
    .gte("checkin_date", days[0])
    .lte("checkin_date", today);

  type Cell = { label: string; className: string };

  function cellFor(branchId: string, day: string): Cell {
    const checkin = (checkins ?? []).find((c) => c.branch_id === branchId && c.checkin_date === day);

    if (!checkin) {
      return { label: "Sin datos", className: "text-muted-foreground" };
    }
    if (checkin.status === "skipped") {
      return { label: "Sin datos", className: "text-muted-foreground" };
    }

    const items = Array.isArray(checkin.compensation_items)
      ? checkin.compensation_items
      : [checkin.compensation_items].filter(Boolean);
    const total = items.reduce((sum: number, i: { total: number } | null) => sum + (i?.total ?? 0), 0);

    return total > 0
      ? { label: formatMoney(total, currency), className: "text-foreground font-medium" }
      : { label: formatMoney(0, currency), className: "text-emerald-700" };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Cumplimiento de registros diarios</h1>
      <Card className="w-fit">
        <CardHeader>
          <CardTitle>Últimos 7 días</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Sucursal</th>
                {days.map((d) => (
                  <th key={d} className="p-2 text-center font-normal text-muted-foreground">
                    {formatShortDayMonth(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(branches ?? []).map((branch) => (
                <tr key={branch.id} className="border-t">
                  <td className="p-2 font-medium">{branch.name}</td>
                  {days.map((d) => {
                    const cell = cellFor(branch.id, d);
                    return (
                      <td key={d} className={`p-2 text-center ${cell.className}`}>
                        {cell.label}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
