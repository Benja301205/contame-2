import Link from "next/link";
import { CurrencyForm } from "@/components/currency-form";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, currency")
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
