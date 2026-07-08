"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CheckinItemInput = {
  typeId: string;
  quantity: number;
  unitCost: number;
  reasonCategory: string;
  note?: string;
};

export type CheckinActionResult = { error?: string };

async function getUserContext() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userRes.user.id)
    .single();
  if (!profile) return null;

  return { supabase, userId: userRes.user.id, orgId: profile.org_id };
}

/**
 * Crea o reemplaza el check-in de `branchId`/`checkinDate` con `items`
 * (array vacío = "no hubo compensaciones", un solo tap). Si ya existe un
 * check-in para esa sucursal/fecha, lo actualiza y reemplaza sus ítems — la
 * policy de RLS solo permite esto si `checkinDate` es hoy (hora argentina);
 * fechas retroactivas se cargan una sola vez.
 */
export async function submitCheckin(
  branchId: string,
  checkinDate: string,
  items: CheckinItemInput[],
): Promise<CheckinActionResult> {
  const ctx = await getUserContext();
  if (!ctx) return { error: "No autenticado." };
  const { supabase, userId, orgId } = ctx;

  const { data: existing } = await supabase
    .from("checkins")
    .select("id")
    .eq("branch_id", branchId)
    .eq("checkin_date", checkinDate)
    .maybeSingle();

  let checkinId = existing?.id as string | undefined;

  if (checkinId) {
    const { error } = await supabase
      .from("checkins")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", checkinId);
    if (error) return { error: error.message };

    const { error: deleteError } = await supabase
      .from("compensation_items")
      .delete()
      .eq("checkin_id", checkinId);
    if (deleteError) return { error: deleteError.message };
  } else {
    const { data: inserted, error } = await supabase
      .from("checkins")
      .insert({
        org_id: orgId,
        branch_id: branchId,
        manager_id: userId,
        checkin_date: checkinDate,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    checkinId = inserted!.id;
  }

  if (items.length > 0) {
    const { error } = await supabase.from("compensation_items").insert(
      items.map((item) => ({
        checkin_id: checkinId,
        type_id: item.typeId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        reason_category: item.reasonCategory,
        note: item.note || null,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/checkin");
  return {};
}

/** Marca un día pendiente (backfill) como "sin datos" sin cargar ítems. */
export async function markCheckinSkipped(
  branchId: string,
  checkinDate: string,
): Promise<CheckinActionResult> {
  const ctx = await getUserContext();
  if (!ctx) return { error: "No autenticado." };
  const { supabase, userId, orgId } = ctx;

  const { error } = await supabase.from("checkins").insert({
    org_id: orgId,
    branch_id: branchId,
    manager_id: userId,
    checkin_date: checkinDate,
    status: "skipped",
    completed_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/checkin");
  return {};
}
