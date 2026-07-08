import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonthPeriod, monthsFromTo, nextPeriod, toPeriod } from "@/lib/loss/period";

export type LossSnapshotResult =
  | { branchId: string; period: string; status: "done" }
  | { branchId: string; period: string; status: "failed"; error: string };

async function findEarliestPeriod(
  admin: SupabaseClient,
  orgId: string,
  branchId: string,
): Promise<string | null> {
  const [{ data: earliestCheckin }, { data: earliestReview }] = await Promise.all([
    admin
      .from("checkins")
      .select("checkin_date")
      .eq("org_id", orgId)
      .eq("branch_id", branchId)
      .order("checkin_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("reviews")
      .select("review_date")
      .eq("org_id", orgId)
      .eq("branch_id", branchId)
      .order("review_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const dates = [earliestCheckin?.checkin_date, earliestReview?.review_date].filter(
    (d): d is string => Boolean(d),
  );
  if (dates.length === 0) return null;

  return toPeriod(dates.sort()[0]);
}

async function computeAndUpsertSnapshot(
  admin: SupabaseClient,
  orgId: string,
  branchId: string,
  period: string,
): Promise<LossSnapshotResult> {
  const periodEnd = nextPeriod(period);

  const [lossRes, byTypeRes, byReasonRes] = await Promise.all([
    admin
      .rpc("compute_branch_loss", {
        p_org_id: orgId,
        p_branch_id: branchId,
        p_period_start: period,
        p_period_end: periodEnd,
      })
      .single(),
    admin.rpc("branch_compensation_breakdown", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_period_start: period,
      p_period_end: periodEnd,
    }),
    admin.rpc("branch_reason_breakdown", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_period_start: period,
      p_period_end: periodEnd,
    }),
  ]);

  if (lossRes.error || !lossRes.data) {
    return {
      branchId,
      period,
      status: "failed",
      error: lossRes.error?.message ?? "compute_branch_loss no devolvió resultado.",
    };
  }

  const loss = lossRes.data as {
    compensation_total: number;
    negative_review_count: number;
    avg_ticket: number | null;
    affected_factor: number;
    estimated_review_loss: number;
  };

  // El breakdown queda congelado dentro del método del snapshot (no se
  // consulta en vivo después): así el desglose histórico sigue siendo
  // explicable aunque los tipos de compensación cambien de nombre o se
  // desactiven más adelante. Ver PROGRESS.md (Loop 6) para el porqué.
  const method = {
    formula: "estimated_review_loss = negative_review_count × avg_ticket × affected_factor",
    avg_ticket: loss.avg_ticket,
    affected_factor: loss.affected_factor,
    negative_review_count: loss.negative_review_count,
    by_compensation_type: byTypeRes.data ?? [],
    by_reason_category: byReasonRes.data ?? [],
  };

  const { error: upsertError } = await admin.from("loss_snapshots").upsert(
    {
      org_id: orgId,
      branch_id: branchId,
      period,
      compensation_total: loss.compensation_total,
      estimated_review_loss: loss.estimated_review_loss,
      method,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "org_id,branch_id,period" },
  );

  if (upsertError) {
    return { branchId, period, status: "failed", error: upsertError.message };
  }

  return { branchId, period, status: "done" };
}

/**
 * Recalcula TODOS los meses con datos de una sucursal — desde el mes del
 * primer checkin/review hasta el mes en curso, no solo el actual. Así la
 * evolución mensual y un cambio de avg_ticket/affected_factor quedan
 * reflejados en toda la historia. Upsert idempotente por
 * (org_id, branch_id, period): correr esto dos veces no duplica filas.
 * Si la sucursal no tiene ningún dato todavía, no genera snapshots vacíos.
 */
export async function recomputeBranchLoss(
  admin: SupabaseClient,
  orgId: string,
  branchId: string,
): Promise<LossSnapshotResult[]> {
  const earliest = await findEarliestPeriod(admin, orgId, branchId);
  if (!earliest) return [];

  const periods = monthsFromTo(earliest, currentMonthPeriod());
  const results: LossSnapshotResult[] = [];
  for (const period of periods) {
    results.push(await computeAndUpsertSnapshot(admin, orgId, branchId, period));
  }
  return results;
}

/** Recalcula todas las sucursales activas de una organización. */
export async function recomputeOrgLoss(
  admin: SupabaseClient,
  orgId: string,
): Promise<LossSnapshotResult[]> {
  const { data: branches } = await admin.from("branches").select("id").eq("org_id", orgId);
  const results: LossSnapshotResult[] = [];
  for (const branch of branches ?? []) {
    results.push(...(await recomputeBranchLoss(admin, orgId, branch.id)));
  }
  return results;
}
