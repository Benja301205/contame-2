import { notFound, redirect } from "next/navigation";
import { toggleBranchActive, updateBranch } from "@/lib/actions/branches";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { BranchForm } from "@/components/branch-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    redirect("/branches");
  }

  const supabase = await createClient();
  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, address, google_place_id, is_active")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  const updateBranchWithId = updateBranch.bind(null, branch.id);
  const toggleActive = async () => {
    "use server";
    await toggleBranchActive(branch.id, !branch.is_active);
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">Editar sucursal</h1>
      <Card>
        <CardHeader>
          <CardTitle>{branch.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BranchForm
            action={updateBranchWithId}
            defaultValues={branch}
            submitLabel="Guardar cambios"
          />
          <form action={toggleActive}>
            <Button type="submit" variant="outline">
              {branch.is_active ? "Desactivar" : "Activar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
