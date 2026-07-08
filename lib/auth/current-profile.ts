import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  userId: string;
  email: string | undefined;
  fullName: string | null;
  role: "admin" | "manager";
  orgId: string;
  orgName: string;
};

/** Perfil del usuario autenticado, o null si no hay sesión o falta el profile. */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, org_id, organizations(name)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const organization = Array.isArray(profile.organizations)
    ? profile.organizations[0]
    : profile.organizations;

  return {
    userId: user.id,
    email: user.email,
    fullName: profile.full_name,
    role: profile.role,
    orgId: profile.org_id,
    orgName: organization?.name ?? "",
  };
}
