"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeOrgLoss } from "@/lib/loss/engine";

export type LossActionResult = { error?: string; recomputed?: number };

/**
 * Botón "Recalcular pérdidas" de Settings/dashboard. Corre server-side con
 * sesión de admin — no pasa por /api/recompute-loss (que solo acepta
 * CRON_SECRET, ver ese archivo), llama al motor directo.
 */
export async function recomputeLossAction(): Promise<LossActionResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "No autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", userRes.user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return { error: "Solo un admin puede recalcular." };
  }

  const admin = createAdminClient();
  const results = await recomputeOrgLoss(admin, profile.org_id);

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/branches");

  return { recomputed: results.filter((r) => r.status === "done").length };
}
