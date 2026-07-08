"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateCompensationTypeCost(
  compensationTypeId: string,
  formData: FormData,
) {
  const cost = Number(formData.get("defaultUnitCost"));
  if (Number.isNaN(cost) || cost < 0) return;

  const supabase = await createClient();
  await supabase
    .from("compensation_types")
    .update({ default_unit_cost: cost })
    .eq("id", compensationTypeId);

  revalidatePath("/settings/compensation-types");
}
