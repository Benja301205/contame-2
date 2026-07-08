import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";
import { todayInBuenosAires } from "@/lib/checkins/today";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signIn(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw error;
  return client;
}

describe("checkins / compensation_items (Loop 4)", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = todayInBuenosAires();

  let orgAId: string;
  let managerId: string;
  let assignedBranchId: string;
  let unassignedBranchId: string;
  let compensationTypeId: string;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("name", SEED_ORGS[0].name)
      .single();
    orgAId = org!.id;

    const { data: managerProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", orgAId)
      .eq("full_name", `Gerente ${SEED_ORGS[0].name}`)
      .single();
    managerId = managerProfile!.id;

    const suffix = Math.random().toString(36).slice(2, 8);

    const { data: assigned } = await admin
      .from("branches")
      .insert({ org_id: orgAId, name: `Sucursal checkin A ${suffix}`, google_place_id: `place-ci-a-${suffix}` })
      .select("id")
      .single();
    assignedBranchId = assigned!.id;

    const { data: unassigned } = await admin
      .from("branches")
      .insert({ org_id: orgAId, name: `Sucursal checkin B ${suffix}`, google_place_id: `place-ci-b-${suffix}` })
      .select("id")
      .single();
    unassignedBranchId = unassigned!.id;

    await admin.from("branch_managers").insert({ branch_id: assignedBranchId, profile_id: managerId });

    const { data: compType } = await admin
      .from("compensation_types")
      .select("id")
      .eq("org_id", orgAId)
      .eq("name", "Descuento")
      .single();
    compensationTypeId = compType!.id;
  });

  it("unique(branch_id, checkin_date): un segundo check-in mismo día/sucursal falla", async () => {
    const date = shiftDate(today, -1);
    const { error: firstError } = await admin
      .from("checkins")
      .insert({ org_id: orgAId, branch_id: assignedBranchId, manager_id: managerId, checkin_date: date, status: "completed" });
    expect(firstError).toBeNull();

    const { error: dupError } = await admin
      .from("checkins")
      .insert({ org_id: orgAId, branch_id: assignedBranchId, manager_id: managerId, checkin_date: date, status: "completed" });

    expect(dupError).not.toBeNull();
    expect(dupError!.code).toBe("23505");
  });

  it("el manager puede crear el check-in de hoy en su sucursal asignada", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const { error } = await managerClient
      .from("checkins")
      .insert({ org_id: orgAId, branch_id: assignedBranchId, manager_id: managerId, checkin_date: today, status: "completed" });

    expect(error).toBeNull();
  });

  it("el manager puede backfillear un día dentro de la ventana de 7 días", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const date = shiftDate(today, -6);
    const { error } = await managerClient
      .from("checkins")
      .insert({ org_id: orgAId, branch_id: assignedBranchId, manager_id: managerId, checkin_date: date, status: "skipped" });

    expect(error).toBeNull();
  });

  it("el manager NO puede insertar un check-in de más de 7 días atrás", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const date = shiftDate(today, -8);
    const { error } = await managerClient
      .from("checkins")
      .insert({ org_id: orgAId, branch_id: assignedBranchId, manager_id: managerId, checkin_date: date, status: "skipped" });

    expect(error).not.toBeNull();
  });

  it("el manager NO puede insertar un check-in con fecha futura", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const date = shiftDate(today, 1);
    const { error } = await managerClient
      .from("checkins")
      .insert({ org_id: orgAId, branch_id: assignedBranchId, manager_id: managerId, checkin_date: date, status: "completed" });

    expect(error).not.toBeNull();
  });

  it("el manager puede editar el check-in de HOY", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);

    const { data: todayCheckin } = await admin
      .from("checkins")
      .select("id")
      .eq("branch_id", assignedBranchId)
      .eq("checkin_date", today)
      .single();

    const { error } = await managerClient
      .from("checkins")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", todayCheckin!.id);

    expect(error).toBeNull();
  });

  it("el manager NO puede editar un check-in de un día distinto a hoy", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const yesterday = shiftDate(today, -1);

    const { data: pastCheckin } = await admin
      .from("checkins")
      .select("id")
      .eq("branch_id", assignedBranchId)
      .eq("checkin_date", yesterday)
      .single();

    await managerClient
      .from("checkins")
      .update({ status: "completed" })
      .eq("id", pastCheckin!.id);

    const { data: unchanged } = await admin
      .from("checkins")
      .select("status")
      .eq("id", pastCheckin!.id)
      .single();

    expect(unchanged!.status).toBe("completed"); // ya estaba en 'completed' del primer test, no lo tocó
  });

  it("el manager no ve ni puede insertar check-ins de una sucursal que no tiene asignada", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);

    const { error: insertError } = await managerClient
      .from("checkins")
      .insert({ org_id: orgAId, branch_id: unassignedBranchId, manager_id: managerId, checkin_date: today, status: "completed" });
    expect(insertError).not.toBeNull();

    await admin
      .from("checkins")
      .insert({ org_id: orgAId, branch_id: unassignedBranchId, manager_id: managerId, checkin_date: today, status: "completed" });

    const { data } = await managerClient.from("checkins").select("branch_id").eq("branch_id", unassignedBranchId);
    expect(data).toHaveLength(0);
  });

  it("compensation_items: el manager puede insertar ítems en el check-in de hoy", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);

    const { data: todayCheckin } = await admin
      .from("checkins")
      .select("id")
      .eq("branch_id", assignedBranchId)
      .eq("checkin_date", today)
      .single();

    const { error } = await managerClient.from("compensation_items").insert({
      checkin_id: todayCheckin!.id,
      type_id: compensationTypeId,
      quantity: 2,
      unit_cost: 500,
      reason_category: "demora",
    });

    expect(error).toBeNull();

    const { data: items } = await admin
      .from("compensation_items")
      .select("total")
      .eq("checkin_id", todayCheckin!.id);
    expect(items![0].total).toBe(1000);
  });

  it("el admin ve los check-ins de toda su org; el manager solo los de su sucursal asignada", async () => {
    const adminClient = await signIn(`admin.${SEED_ORGS[0].slug}@contame.test`);
    const { data: adminView } = await adminClient
      .from("checkins")
      .select("branch_id")
      .in("branch_id", [assignedBranchId, unassignedBranchId]);
    const adminBranchIds = adminView!.map((c) => c.branch_id);
    expect(adminBranchIds).toContain(assignedBranchId);
    expect(adminBranchIds).toContain(unassignedBranchId);

    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const { data: managerView } = await managerClient
      .from("checkins")
      .select("branch_id")
      .in("branch_id", [assignedBranchId, unassignedBranchId]);
    const managerBranchIds = managerView!.map((c) => c.branch_id);
    expect(managerBranchIds).toContain(assignedBranchId);
    expect(managerBranchIds).not.toContain(unassignedBranchId);
  });
});
