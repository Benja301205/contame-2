import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS } from "@/lib/seed-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Especificación ejecutable del motor de pérdidas (Loop 6, criterio de
 * aceptación 1): para un mes con datos fixture conocidos, compute_branch_loss
 * tiene que devolver EXACTAMENTE los valores calculados a mano. Se escribe
 * antes de la migración 0007 a propósito — corre en rojo hasta que exista
 * la función SQL.
 *
 * Fórmula (Anexo/PRD): estimated_review_loss = reviews_negativas_del_período
 * × avg_ticket × affected_factor. compensation_total = suma de
 * compensation_items.total de los checkins del período. Nunca se suman
 * entre sí (quedan siempre en columnas separadas).
 */
describe("compute_branch_loss vs. cálculo manual", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgId: string;
  let originalAvgTicket: number | null;
  let originalAffectedFactor: number;
  let compensationTypeId: string;

  const PERIOD_START = "2026-06-01";
  const PERIOD_END = "2026-07-01";

  async function setOrgParams(avgTicket: number | null, affectedFactor: number) {
    await admin
      .from("organizations")
      .update({ avg_ticket: avgTicket, affected_factor: affectedFactor })
      .eq("id", orgId);
  }

  async function makeBranch(name: string) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const { data } = await admin
      .from("branches")
      .insert({ org_id: orgId, name: `${name} ${suffix}`, google_place_id: `place-loss-${suffix}` })
      .select("id")
      .single();
    return data!.id as string;
  }

  async function insertReview(branchId: string, sentiment: string, rating: number, date: string, i: number) {
    const { data: review } = await admin
      .from("reviews")
      .insert({
        org_id: orgId,
        branch_id: branchId,
        provider_review_id: `loss-${branchId}-${i}`,
        rating,
        text: "fixture",
        review_date: date,
      })
      .select("id")
      .single();

    await admin.from("review_analysis").insert({
      review_id: review!.id,
      sentiment,
      categories: sentiment === "negative" ? ["demora"] : [],
      severity: sentiment === "negative" ? 2 : 1,
      mentions_compensation: false,
      summary: "fixture",
      model: "test",
    });
  }

  async function insertCheckinWithItems(
    branchId: string,
    date: string,
    items: { quantity: number; unitCost: number }[],
  ) {
    const { data: managerProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", orgId)
      .eq("full_name", `Gerente ${SEED_ORGS[0].name}`)
      .single();

    const { data: checkin } = await admin
      .from("checkins")
      .insert({
        org_id: orgId,
        branch_id: branchId,
        manager_id: managerProfile!.id,
        checkin_date: date,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    for (const item of items) {
      await admin.from("compensation_items").insert({
        checkin_id: checkin!.id,
        type_id: compensationTypeId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        reason_category: "demora",
      });
    }
  }

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id, avg_ticket, affected_factor")
      .eq("name", SEED_ORGS[0].name)
      .single();
    orgId = org!.id;
    originalAvgTicket = org!.avg_ticket;
    originalAffectedFactor = org!.affected_factor;

    const { data: compType } = await admin
      .from("compensation_types")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", "Descuento")
      .single();
    compensationTypeId = compType!.id;
  });

  afterAll(async () => {
    await setOrgParams(originalAvgTicket, originalAffectedFactor);
  });

  it("mes completo: compensación real + reviews negativas, avg_ticket=1000 affected_factor=2", async () => {
    await setOrgParams(1000, 2);
    const branchId = await makeBranch("Completo");

    // compensation_total = (2 × 300) + (1 × 150) = 750
    await insertCheckinWithItems(branchId, "2026-06-05", [
      { quantity: 2, unitCost: 300 },
      { quantity: 1, unitCost: 150 },
    ]);

    // 3 negativas + 1 positiva (no cuenta) en el período
    await insertReview(branchId, "negative", 1, "2026-06-10", 0);
    await insertReview(branchId, "negative", 2, "2026-06-15", 1);
    await insertReview(branchId, "negative", 1, "2026-06-20", 2);
    await insertReview(branchId, "positive", 5, "2026-06-22", 3);
    // fuera del período: no debe contarse
    await insertReview(branchId, "negative", 1, "2026-05-30", 4);

    const { data, error } = await admin
      .rpc("compute_branch_loss", {
        p_org_id: orgId,
        p_branch_id: branchId,
        p_period_start: PERIOD_START,
        p_period_end: PERIOD_END,
      })
      .single();

    expect(error).toBeNull();
    // compensation_total = 750 (calculado a mano)
    expect(Number(data!.compensation_total)).toBe(750);
    // negative_review_count = 3 (solo dentro del período)
    expect(Number(data!.negative_review_count)).toBe(3);
    // estimated_review_loss = 3 × 1000 × 2 = 6000
    expect(Number(data!.estimated_review_loss)).toBe(6000);
  });

  it("mes sin check-ins: compensation_total = 0, estimated_review_loss se calcula igual", async () => {
    await setOrgParams(500, 1);
    const branchId = await makeBranch("SinCheckins");

    await insertReview(branchId, "negative", 2, "2026-06-05", 0);
    await insertReview(branchId, "negative", 1, "2026-06-06", 1);

    const { data } = await admin
      .rpc("compute_branch_loss", {
        p_org_id: orgId,
        p_branch_id: branchId,
        p_period_start: PERIOD_START,
        p_period_end: PERIOD_END,
      })
      .single();

    expect(Number(data!.compensation_total)).toBe(0);
    expect(Number(data!.negative_review_count)).toBe(2);
    // 2 × 500 × 1 = 1000
    expect(Number(data!.estimated_review_loss)).toBe(1000);
  });

  it("mes sin reviews negativas: estimated_review_loss = 0, compensation_total se calcula igual", async () => {
    await setOrgParams(500, 1);
    const branchId = await makeBranch("SinReviews");

    await insertCheckinWithItems(branchId, "2026-06-10", [{ quantity: 1, unitCost: 200 }]);

    const { data } = await admin
      .rpc("compute_branch_loss", {
        p_org_id: orgId,
        p_branch_id: branchId,
        p_period_start: PERIOD_START,
        p_period_end: PERIOD_END,
      })
      .single();

    expect(Number(data!.compensation_total)).toBe(200);
    expect(Number(data!.negative_review_count)).toBe(0);
    expect(Number(data!.estimated_review_loss)).toBe(0);
  });

  it("avg_ticket NULL: estimated_review_loss siempre 0, nunca inventa un default de plata", async () => {
    await setOrgParams(null, 1);
    const branchId = await makeBranch("SinTicket");

    await insertReview(branchId, "negative", 1, "2026-06-05", 0);
    await insertReview(branchId, "negative", 1, "2026-06-06", 1);

    const { data } = await admin
      .rpc("compute_branch_loss", {
        p_org_id: orgId,
        p_branch_id: branchId,
        p_period_start: PERIOD_START,
        p_period_end: PERIOD_END,
      })
      .single();

    expect(data!.avg_ticket).toBeNull();
    expect(Number(data!.negative_review_count)).toBe(2);
    expect(Number(data!.estimated_review_loss)).toBe(0);
  });

  it("breakdown por tipo de compensación y por categoría de motivo coincide con lo cargado", async () => {
    await setOrgParams(1000, 1);
    const branchId = await makeBranch("Breakdown");

    const { data: postreType } = await admin
      .from("compensation_types")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", "Postre bonificado")
      .single();

    const { data: managerProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", orgId)
      .eq("full_name", `Gerente ${SEED_ORGS[0].name}`)
      .single();

    const { data: checkin } = await admin
      .from("checkins")
      .insert({
        org_id: orgId,
        branch_id: branchId,
        manager_id: managerProfile!.id,
        checkin_date: "2026-06-12",
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    await admin.from("compensation_items").insert([
      {
        checkin_id: checkin!.id,
        type_id: compensationTypeId,
        quantity: 2,
        unit_cost: 300,
        reason_category: "demora",
      },
      {
        checkin_id: checkin!.id,
        type_id: postreType!.id,
        quantity: 1,
        unit_cost: 100,
        reason_category: "calidad_comida",
      },
    ]);

    const { data: byType } = await admin.rpc("branch_compensation_breakdown", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_period_start: PERIOD_START,
      p_period_end: PERIOD_END,
    });
    const byTypeMap = new Map(byType!.map((r: { type_name: string; total: number }) => [r.type_name, Number(r.total)]));
    expect(byTypeMap.get("Descuento")).toBe(600);
    expect(byTypeMap.get("Postre bonificado")).toBe(100);

    const { data: byReason } = await admin.rpc("branch_reason_breakdown", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_period_start: PERIOD_START,
      p_period_end: PERIOD_END,
    });
    const byReasonMap = new Map(
      byReason!.map((r: { reason_category: string; total: number }) => [r.reason_category, Number(r.total)]),
    );
    expect(byReasonMap.get("demora")).toBe(600);
    expect(byReasonMap.get("calidad_comida")).toBe(100);
  });
});
