import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";

/**
 * "/" no muestra nada propio (Loop 8: el admin aterriza directo en el Panel,
 * no en una pantalla de cuenta intermedia) — solo redirige según el rol.
 */
export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (profile?.role === "manager") {
    redirect("/checkin");
  }

  redirect("/dashboard");
}
