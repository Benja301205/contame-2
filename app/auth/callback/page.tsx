"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Los links de invite/recovery de Supabase local usan flujo implícito:
 * el token llega en el fragmento de la URL (#access_token=...), no en un
 * query param. El fragmento nunca llega al servidor, así que la sesión se
 * establece acá, en el cliente, y recién después navegamos.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("Link de invitación inválido o vencido.");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setError("No se pudo validar la invitación.");
          return;
        }
        router.replace("/set-password");
      });
  }, [router]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      {error ?? "Validando invitación..."}
    </div>
  );
}
