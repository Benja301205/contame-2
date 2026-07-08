import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Regresión de la auditoría de seguridad del Loop 0:
 * 1. Auto-registro público deshabilitado (enable_signup=false).
 * 2. Un manager no puede auto-ascenderse a admin vía update de su propio profile.
 */
describe("hardening de seguridad", () => {
  it("signUp con la anon key falla (signups deshabilitados)", async () => {
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await client.auth.signUp({
      email: `intruso.${Date.now()}@contame.test`,
      password: "Contame123!",
      options: {
        data: { org_id: SEED_ORGS[0].slug, role: "admin", full_name: "Intruso" },
      },
    });

    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("un manager no puede auto-ascenderse a admin", async () => {
    const managerClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signInData, error: signInError } =
      await managerClient.auth.signInWithPassword({
        email: `manager.${SEED_ORGS[0].slug}@contame.test`,
        password: SEED_PASSWORD,
      });
    if (signInError) throw signInError;

    const managerId = signInData.user!.id;

    await managerClient
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", managerId);

    const { data: profile, error } = await managerClient
      .from("profiles")
      .select("role")
      .eq("id", managerId)
      .single();

    expect(error).toBeNull();
    expect(profile!.role).toBe("manager");
  });
});
