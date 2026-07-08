"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OrgActionResult = { error?: string };

const CURRENCIES = ["ARS", "USD", "UYU", "CLP", "MXN"];

export async function updateCurrency(
  _prev: OrgActionResult,
  formData: FormData,
): Promise<OrgActionResult> {
  const currency = String(formData.get("currency") ?? "");

  if (!CURRENCIES.includes(currency)) {
    return { error: "Moneda inválida." };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "No autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userRes.user.id)
    .single();
  if (!profile) return { error: "No se encontró el perfil." };

  const { error } = await supabase
    .from("organizations")
    .update({ currency })
    .eq("id", profile.org_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}

export { CURRENCIES };
