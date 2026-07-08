"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { CurrentProfile } from "@/lib/auth/current-profile";

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "text-sm font-medium text-primary"
          : "text-sm text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

export function Nav({ profile }: { profile: CurrentProfile }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const homeHref = profile.role === "manager" ? "/checkin" : "/dashboard";
  const homeLabel = profile.role === "manager" ? "Registro del día" : "Panel";

  return (
    <nav className="flex flex-wrap items-center justify-between gap-y-2 border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <span className="font-semibold">Contame</span>
        <NavLink href={homeHref} active={pathname.startsWith(homeHref)}>
          {homeLabel}
        </NavLink>
        <NavLink href="/branches" active={pathname.startsWith("/branches")}>
          {profile.role === "admin" ? "Sucursales" : "Mis sucursales"}
        </NavLink>
        <NavLink href="/reviews" active={pathname.startsWith("/reviews")}>
          Reseñas
        </NavLink>
        {profile.role === "admin" && (
          <NavLink href="/settings" active={pathname.startsWith("/settings")}>
            Configuración
          </NavLink>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden text-right text-sm sm:block">
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
