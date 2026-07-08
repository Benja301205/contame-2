"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { CurrentProfile } from "@/lib/auth/current-profile";

export function Nav({ profile }: { profile: CurrentProfile }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-6">
        <span className="font-semibold">Contame</span>
        <Link
          href={profile.role === "manager" ? "/checkin" : "/"}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {profile.role === "manager" ? "Check-in" : "Inicio"}
        </Link>
        <Link href="/branches" className="text-sm text-muted-foreground hover:text-foreground">
          {profile.role === "admin" ? "Sucursales" : "Mis sucursales"}
        </Link>
        <Link href="/reviews" className="text-sm text-muted-foreground hover:text-foreground">
          Reviews
        </Link>
        {profile.role === "admin" && (
          <>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Configuración
            </Link>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p className="font-medium">{profile.fullName ?? profile.email}</p>
          <p className="text-muted-foreground">
            {profile.role === "admin" ? "Admin" : "Gerente"} · {profile.orgName}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Salir
        </Button>
      </div>
    </nav>
  );
}
