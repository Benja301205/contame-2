import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw error;
  return client;
}

describe("RLS de branches / branch_managers / organizations (Loop 1)", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgAId: string;
  let assignedBranchId: string;
  let unassignedBranchId: string;
  let managerId: string;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("name", SEED_ORGS[0].name)
      .single();
    orgAId = org!.id;

    const { data: managerUser } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("org_id", orgAId)
      .eq("role", "manager")
      .eq("full_name", `Gerente ${SEED_ORGS[0].name}`)
      .single();
    managerId = managerUser!.id;

    const suffix = Math.random().toString(36).slice(2, 8);

    const { data: assigned } = await admin
      .from("branches")
      .insert({
        org_id: orgAId,
        name: `Sucursal asignada ${suffix}`,
        google_place_id: `place-assigned-${suffix}`,
      })
      .select("id")
      .single();
    assignedBranchId = assigned!.id;

    const { data: unassigned } = await admin
      .from("branches")
      .insert({
        org_id: orgAId,
        name: `Sucursal no asignada ${suffix}`,
        google_place_id: `place-unassigned-${suffix}`,
      })
      .select("id")
      .single();
    unassignedBranchId = unassigned!.id;

    await admin
      .from("branch_managers")
      .insert({ branch_id: assignedBranchId, profile_id: managerId });
  });

  it("el manager solo lee las sucursales que tiene asignadas", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const { data, error } = await managerClient.from("branches").select("id");

    expect(error).toBeNull();
    const ids = data!.map((b) => b.id);
    expect(ids).toContain(assignedBranchId);
    expect(ids).not.toContain(unassignedBranchId);
  });

  it("el manager no puede insertar sucursales", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const { error } = await managerClient
      .from("branches")
      .insert({ org_id: orgAId, name: "Intento manager", google_place_id: "intento-manager" });

    expect(error).not.toBeNull();
  });

  it("el manager no puede editar una sucursal asignada", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    await managerClient
      .from("branches")
      .update({ name: "Nombre hackeado" })
      .eq("id", assignedBranchId);

    const { data } = await admin
      .from("branches")
      .select("name")
      .eq("id", assignedBranchId)
      .single();

    expect(data!.name).not.toBe("Nombre hackeado");
  });

  it("el admin puede crear una sucursal en su org", async () => {
    const adminClient = await signIn(`admin.${SEED_ORGS[0].slug}@contame.test`);
    const suffix = Math.random().toString(36).slice(2, 8);
    const { error } = await adminClient
      .from("branches")
      .insert({ org_id: orgAId, name: "Nueva sucursal admin", google_place_id: `admin-${suffix}` });

    expect(error).toBeNull();
  });

  it("google_place_id es único por organización", async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const placeId = `place-dup-${suffix}`;

    const { error: firstError } = await admin
      .from("branches")
      .insert({ org_id: orgAId, name: "Sucursal A", google_place_id: placeId });
    expect(firstError).toBeNull();

    const { error: dupError } = await admin
      .from("branches")
      .insert({ org_id: orgAId, name: "Sucursal B", google_place_id: placeId });

    expect(dupError).not.toBeNull();
    expect(dupError!.code).toBe("23505");
  });

  it("el admin puede editar la moneda de su organización", async () => {
    const adminClient = await signIn(`admin.${SEED_ORGS[0].slug}@contame.test`);
    const { error } = await adminClient
      .from("organizations")
      .update({ currency: "USD" })
      .eq("id", orgAId);

    expect(error).toBeNull();

    const { data } = await admin
      .from("organizations")
      .select("currency")
      .eq("id", orgAId)
      .single();
    expect(data!.currency).toBe("USD");

    await admin.from("organizations").update({ currency: "ARS" }).eq("id", orgAId);
  });

  it("los tipos de compensación default existen para la org (seed automático)", async () => {
    const { data } = await admin
      .from("compensation_types")
      .select("name")
      .eq("org_id", orgAId);

    const names = data!.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Descuento",
        "Postre bonificado",
        "Bebida bonificada",
        "Devolución",
        "Plato rehecho",
        "Otro",
      ]),
    );
  });
});
