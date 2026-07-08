"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currencies";

export type OrgActionResult = { error?: string };

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

export async function updateLossParams(
  _prev: OrgActionResult,
  formData: FormData,
): Promise<OrgActionResult> {
  const avgTicketRaw = String(formData.get("avgTicket") ?? "").trim();
  const affectedFactorRaw = String(formData.get("affectedFactor") ?? "1").trim();

  const avgTicket = avgTicketRaw === "" ? null : Number(avgTicketRaw);
  const affectedFactor = Number(affectedFactorRaw);

  if (avgTicket !== null && (Number.isNaN(avgTicket) || avgTicket < 0)) {
    return { error: "El ticket promedio tiene que ser un número positivo (o vacío para no estimar)." };
  }
  if (Number.isNaN(affectedFactor) || affectedFactor <= 0) {
    return { error: "El factor de clientes afectados tiene que ser un número positivo." };
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
    .update({ avg_ticket: avgTicket, affected_factor: affectedFactor })
    .eq("id", profile.org_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}
