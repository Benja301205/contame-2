import Link from "next/link";
import { CurrencyForm } from "@/components/currency-form";
import { LossParamsForm } from "@/components/loss-params-form";
import { RecomputeLossButton } from "@/components/loss/recompute-loss-button";
import { MethodologyModal } from "@/components/loss/methodology-modal";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, currency, avg_ticket, affected_factor")
    .eq("id", profile?.orgId)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Configuración</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{organization?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CurrencyForm currentCurrency={organization?.currency ?? "ARS"} />
        </CardContent>
      </Card>

      <Card className="max-w-lg" data-testid="loss-params-card">
        <CardHeader>
          <CardTitle>Pérdida estimada por reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LossParamsForm
            avgTicket={organization?.avg_ticket ?? null}
            affectedFactor={organization?.affected_factor ?? 1}
          />
          <div className="flex items-center gap-3">
            <RecomputeLossButton />
            <MethodologyModal
              avgTicket={organization?.avg_ticket ?? null}
              affectedFactor={organization?.affected_factor ?? 1}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardContent className="space-y-2 py-4">
          <Link href="/settings/users" className="block text-sm underline underline-offset-2">
            Usuarios y sucursales asignadas
          </Link>
          <Link
            href="/settings/compensation-types"
            className="block text-sm underline underline-offset-2"
          >
            Tipos de compensación
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
