import Link from "next/link";
import { StoreIcon } from "lucide-react";
import { createBranch } from "@/lib/actions/branches";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { BranchForm } from "@/components/branch-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default async function BranchesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, address, google_place_id, is_active")
    .order("name");

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        {isAdmin ? "Sucursales" : "Mis sucursales"}
      </h1>

      <div className="space-y-2">
        {(branches ?? []).length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>
                {isAdmin ? "Todavía no hay sucursales" : "No tenés sucursales asignadas"}
              </EmptyTitle>
              <EmptyDescription>
                {isAdmin
                  ? "Creá la primera con el formulario de abajo."
                  : "Pedile a tu admin que te asigne una sucursal."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {(branches ?? []).map((branch) => (
          <Card key={branch.id} className="max-w-lg">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">
                  {branch.name}
                  {!branch.is_active && (
                    <span className="ml-2 text-xs text-muted-foreground">(inactiva)</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{branch.address}</p>
              </div>
              {isAdmin && (
                <Link
                  href={`/branches/${branch.id}`}
                  className="text-sm underline underline-offset-2"
                >
                  Editar
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Nueva sucursal</CardTitle>
          </CardHeader>
          <CardContent>
            <BranchForm action={createBranch} submitLabel="Crear sucursal" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
