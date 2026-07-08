import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { todayInBuenosAires } from "@/lib/checkins/today";
import { getPendingBackfillDays } from "@/lib/checkins/backfill";
import { CheckinDayPanel, type ExistingCheckin } from "@/components/checkin-day-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function loadExistingCheckin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  date: string,
): Promise<ExistingCheckin | null> {
  const { data: checkin } = await supabase
    .from("checkins")
    .select("id, status")
    .eq("branch_id", branchId)
    .eq("checkin_date", date)
    .maybeSingle();

  if (!checkin) return null;

  if (checkin.status === "skipped") {
    return { status: "skipped", items: [], total: 0 };
  }

  const { data: items } = await supabase
    .from("compensation_items")
    .select("quantity, unit_cost, total, compensation_types(name)")
    .eq("checkin_id", checkin.id);

  const mappedItems = (items ?? []).map((item) => {
    const typeList = Array.isArray(item.compensation_types)
      ? item.compensation_types
      : [item.compensation_types];
    return {
      typeName: typeList[0]?.name ?? "Otro",
      quantity: item.quantity,
      unitCost: item.unit_cost,
      total: item.total,
    };
  });

  return {
    status: "completed",
    items: mappedItems,
    total: mappedItems.reduce((sum, i) => sum + i.total, 0),
  };
}

export default async function CheckinPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  if (profile?.role === "admin") {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Check-in</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          El check-in diario lo completa el gerente de cada sucursal.
        </CardContent>
      </Card>
    );
  }

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: compensationTypes } = await supabase
    .from("compensation_types")
    .select("id, name, default_unit_cost")
    .eq("is_active", true)
    .order("name");

  const today = todayInBuenosAires();

  if (!branches || branches.length === 0) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Check-in</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No tenés sucursales asignadas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {await Promise.all(
        branches.map(async (branch) => {
          const todayCheckin = await loadExistingCheckin(supabase, branch.id, today);

          const { data: existingCheckins } = await supabase
            .from("checkins")
            .select("checkin_date")
            .eq("branch_id", branch.id);

          const existingDates = (existingCheckins ?? []).map((c) => c.checkin_date as string);
          const pendingDays = getPendingBackfillDays(existingDates, today);

          return (
            <div key={branch.id} className="space-y-4">
              <h2 className="text-lg font-semibold">{branch.name}</h2>
              <CheckinDayPanel
                branchId={branch.id}
                date={today}
                isToday
                compensationTypes={compensationTypes ?? []}
                existing={todayCheckin}
              />
              {pendingDays.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Días pendientes</p>
                  {pendingDays.map((day) => (
                    <CheckinDayPanel
                      key={day}
                      branchId={branch.id}
                      date={day}
                      isToday={false}
                      compensationTypes={compensationTypes ?? []}
                      existing={null}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
