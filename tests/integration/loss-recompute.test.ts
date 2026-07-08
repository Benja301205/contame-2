import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";
import { recomputeBranchLoss, recomputeOrgLoss } from "@/lib/loss/engine";
import { currentMonthPeriod } from "@/lib/loss/period";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signIn(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw error;
  return client;
}

describe("recompute de loss_snapshots", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgId: string;
  let originalAvgTicket: number | null;
  let originalAffectedFactor: number;
  let branchId: string;
  let managerId: string;
  let compensationTypeId: string;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id, avg_ticket, affected_factor")
      .eq("name", SEED_ORGS[0].name)
      .single();
    orgId = org!.id;
    originalAvgTicket = org!.avg_ticket;
    originalAffectedFactor = org!.affected_factor;
    await admin.from("organizations").update({ avg_ticket: 1000, affected_factor: 1 }).eq("id", orgId);

    const { data: managerProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", orgId)
      .eq("full_name", `Gerente ${SEED_ORGS[0].name}`)
      .single();
    managerId = managerProfile!.id;

    const { data: compType } = await admin
      .from("compensation_types")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", "Descuento")
      .single();
    compensationTypeId = compType!.id;

    const suffix = Math.random().toString(36).slice(2, 8);
    const { data: branch } = await admin
      .from("branches")
      .insert({ org_id: orgId, name: `Sucursal recompute ${suffix}`, google_place_id: `place-recompute-${suffix}` })
      .select("id")
      .single();
    branchId = branch!.id;

    await admin.from("branch_managers").insert({ branch_id: branchId, profile_id: managerId });

    // Datos en dos meses distintos: mayo y junio 2026.
    for (const [i, date] of ["2026-05-05", "2026-06-05"].entries()) {
      const { data: checkin } = await admin
        .from("checkins")
        .insert({
          org_id: orgId,
          branch_id: branchId,
          manager_id: managerId,
          checkin_date: date,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      await admin.from("compensation_items").insert({
        checkin_id: checkin!.id,
        type_id: compensationTypeId,
        quantity: 1,
        unit_cost: 100 * (i + 1),
        reason_category: "demora",
      });

      const { data: review } = await admin
        .from("reviews")
        .insert({
          org_id: orgId,
          branch_id: branchId,
          provider_review_id: `recompute-${branchId}-${i}`,
          rating: 1,
          text: "fixture",
          review_date: date,
        })
        .select("id")
        .single();
      await admin.from("review_analysis").insert({
        review_id: review!.id,
        sentiment: "negative",
        categories: ["demora"],
        severity: 2,
        mentions_compensation: false,
        summary: "fixture",
        model: "test",
      });
    }
  });

  afterAll(async () => {
    await admin
      .from("organizations")
      .update({ avg_ticket: originalAvgTicket, affected_factor: originalAffectedFactor })
      .eq("id", orgId);
  });

  it("genera un snapshot por cada mes con datos, desde el primero hasta el mes en curso", async () => {
    const results = await recomputeBranchLoss(admin, orgId, branchId);

    const { data: snapshots } = await admin
      .from("loss_snapshots")
      .select("period, compensation_total, estimated_review_loss")
      .eq("branch_id", branchId)
      .order("period", { ascending: true });

    expect(results.every((r) => r.status === "done")).toBe(true);
    expect(snapshots!.length).toBeGreaterThanOrEqual(2);
    expect(snapshots![0].period.slice(0, 7)).toBe("2026-05");

    const june = snapshots!.find((s) => s.period.slice(0, 7) === "2026-06")!;
    expect(Number(june.compensation_total)).toBe(200);
    expect(Number(june.estimated_review_loss)).toBe(1000);

    // el mes en curso también se snapshotea (parcial), aunque no tenga datos propios.
    expect(snapshots!.some((s) => s.period === currentMonthPeriod())).toBe(true);
  });

  it("correr el recompute 2 veces no duplica snapshots (idempotente)", async () => {
    await recomputeBranchLoss(admin, orgId, branchId);
    const { count: firstCount } = await admin
      .from("loss_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId);

    await recomputeBranchLoss(admin, orgId, branchId);
    const { count: secondCount } = await admin
      .from("loss_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId);

    expect(secondCount).toBe(firstCount);
  });

  it("cambiar avg_ticket y recalcular actualiza el valor del snapshot existente", async () => {
    await recomputeBranchLoss(admin, orgId, branchId);
    const { data: before } = await admin
      .from("loss_snapshots")
      .select("estimated_review_loss")
      .eq("branch_id", branchId)
      .eq("period", "2026-06-01")
      .single();
    expect(Number(before!.estimated_review_loss)).toBe(1000);

    await admin.from("organizations").update({ avg_ticket: 5000 }).eq("id", orgId);
    await recomputeBranchLoss(admin, orgId, branchId);

    const { data: after } = await admin
      .from("loss_snapshots")
      .select("estimated_review_loss")
      .eq("branch_id", branchId)
      .eq("period", "2026-06-01")
      .single();
    // 1 review negativa en junio × 5000 × 1 = 5000
    expect(Number(after!.estimated_review_loss)).toBe(5000);

    await admin.from("organizations").update({ avg_ticket: 1000 }).eq("id", orgId);
  });

  it("recomputeOrgLoss recorre todas las sucursales de la org sin fallar", async () => {
    const results = await recomputeOrgLoss(admin, orgId);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.status === "done")).toBe(true);
  });

  it("RLS: el manager solo lee snapshots de su sucursal asignada; el admin ve todas", async () => {
    await recomputeBranchLoss(admin, orgId, branchId);

    const suffix = Math.random().toString(36).slice(2, 8);
    const { data: otherBranch } = await admin
      .from("branches")
      .insert({ org_id: orgId, name: `Sucursal sin asignar ${suffix}`, google_place_id: `place-noassign-${suffix}` })
      .select("id")
      .single();
    await admin
      .from("loss_snapshots")
      .insert({ org_id: orgId, branch_id: otherBranch!.id, period: "2026-06-01", compensation_total: 999, estimated_review_loss: 0, method: {} });

    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const { data: managerView } = await managerClient.from("loss_snapshots").select("branch_id");
    const managerBranchIds = managerView!.map((s) => s.branch_id);
    expect(managerBranchIds).toContain(branchId);
    expect(managerBranchIds).not.toContain(otherBranch!.id);

    const adminClient = await signIn(`admin.${SEED_ORGS[0].slug}@contame.test`);
    const { data: adminView } = await adminClient.from("loss_snapshots").select("branch_id");
    const adminBranchIds = adminView!.map((s) => s.branch_id);
    expect(adminBranchIds).toContain(branchId);
    expect(adminBranchIds).toContain(otherBranch!.id);
  });
});
