"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const branchSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  address: z.string().optional(),
  googlePlaceId: z.string().min(1, "El Google Place ID es obligatorio."),
});

export type BranchActionResult = { error?: string };

export async function createBranch(
  _prev: BranchActionResult,
  formData: FormData,
): Promise<BranchActionResult> {
  const parsed = branchSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? undefined,
    googlePlaceId: formData.get("googlePlaceId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
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

  const { error } = await supabase.from("branches").insert({
    org_id: profile.org_id,
    name: parsed.data.name,
    address: parsed.data.address || null,
    google_place_id: parsed.data.googlePlaceId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una sucursal con ese Google Place ID en tu organización." };
    }
    return { error: error.message };
  }

  revalidatePath("/branches");
  return {};
}

export async function updateBranch(
  branchId: string,
  _prev: BranchActionResult,
  formData: FormData,
): Promise<BranchActionResult> {
  const parsed = branchSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? undefined,
    googlePlaceId: formData.get("googlePlaceId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .update({
      name: parsed.data.name,
      address: parsed.data.address || null,
      google_place_id: parsed.data.googlePlaceId,
    })
    .eq("id", branchId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una sucursal con ese Google Place ID en tu organización." };
    }
    return { error: error.message };
  }

  revalidatePath("/branches");
  revalidatePath(`/branches/${branchId}`);
  return {};
}

export async function toggleBranchActive(branchId: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase.from("branches").update({ is_active: isActive }).eq("id", branchId);
  revalidatePath("/branches");
  revalidatePath(`/branches/${branchId}`);
}
