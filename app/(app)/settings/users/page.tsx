import { createClient } from "@/lib/supabase/server";
import { InviteManagerForm } from "@/components/invite-manager-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UsersPage() {
  const supabase = await createClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: managers } = await supabase
    .from("profiles")
    .select("id, full_name, branch_managers(branches(name))")
    .eq("role", "manager")
    .order("full_name");

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">Usuarios</h1>

      <Card>
        <CardHeader>
          <CardTitle>Gerentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(managers ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no invitaste gerentes.</p>
          )}
          {(managers ?? []).map((m) => (
            <div key={m.id} className="text-sm">
              <p className="font-medium">{m.full_name}</p>
              <p className="text-muted-foreground">
                {(m.branch_managers ?? [])
                  .flatMap((bm) => (Array.isArray(bm.branches) ? bm.branches : [bm.branches]))
                  .map((b) => b?.name)
                  .filter(Boolean)
                  .join(", ") || "sin sucursales asignadas"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitar gerente</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteManagerForm branches={branches ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
