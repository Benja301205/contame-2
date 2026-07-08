import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth/current-profile";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  // La home del gerente es el check-in del día (Loop 4, criterio 1: mínima
  // fricción). El admin sigue viendo esta pantalla de cuenta.
  if (profile?.role === "manager") {
    redirect("/checkin");
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Tu cuenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Nombre:</span>{" "}
          {profile?.fullName ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Rol:</span>{" "}
          {profile?.role === "admin" ? "Admin" : "Gerente"}
        </p>
        <p>
          <span className="text-muted-foreground">Organización:</span>{" "}
          {profile?.orgName}
        </p>
      </CardContent>
    </Card>
  );
}
