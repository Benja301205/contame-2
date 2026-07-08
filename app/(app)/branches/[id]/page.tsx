import { notFound, redirect } from "next/navigation";
import { toggleBranchActive, updateBranch } from "@/lib/actions/branches";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { getPeriodWindows } from "@/lib/dashboard/period";
import { BranchForm } from "@/components/branch-form";
import { TrendChart } from "@/components/charts/trend-chart";
import { CategoryBarChart } from "@/components/charts/category-bar";
import { LossSummary } from "@/components/loss/loss-summary";
import { LossBreakdown, type LossBreakdownItem } from "@/components/loss/loss-breakdown";
import { MethodologyModal } from "@/components/loss/methodology-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LossSnapshotRow = {
  period: string;
  compensation_total: number;
  estimated_review_loss: number;
  method: {
    avg_ticket: number | null;
    affected_factor: number;
    by_compensation_type: { type_name: string; total: number }[];
    by_reason_category: { reason_category: string; total: number }[];
  } | null;
};

type MonthlyRow = { month: string; avg_rating: number | null; review_count: number };
type SeverityRow = { severity: number; review_count: number };

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    redirect("/branches");
  }

  const supabase = await createClient();
  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, address, google_place_id, is_active")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  const { currentStart, currentEnd } = getPeriodWindows(90);

  const [monthlyRes, severityRes, criticalRes] = await Promise.all([
    supabase.rpc("branch_rating_monthly", { p_org_id: profile!.orgId, p_branch_id: branch.id, p_since: currentStart }),
    supabase.rpc("branch_severity_breakdown", {
      p_org_id: profile!.orgId,
      p_branch_id: branch.id,
      p_start: currentStart,
      p_end: currentEnd,
    }),
    supabase
      .from("reviews")
      .select("id, author_name, text, review_date, review_analysis!inner(severity)")
      .eq("branch_id", branch.id)
      .eq("review_analysis.severity", 3)
      .order("review_date", { ascending: false })
      .limit(5),
  ]);

  const monthly = ((monthlyRes.data as MonthlyRow[] | null) ?? []).map((r) => ({
    label: r.month.slice(0, 7),
    value: r.avg_rating != null ? Number(r.avg_rating) : 0,
  }));

  const severity = ((severityRes.data as SeverityRow[] | null) ?? []).map((r) => ({
    category: `Severidad ${r.severity}`,
    count: r.review_count,
  }));

  const criticalReviews = criticalRes.data ?? [];

  const { data: syncJobs } = await supabase
    .from("sync_jobs")
    .select("id, status, started_at, error, stats")
    .eq("branch_id", branch.id)
    .order("started_at", { ascending: false })
    .limit(3);

  const { data: lossSnapshotsRaw } = await supabase
    .from("loss_snapshots")
    .select("period, compensation_total, estimated_review_loss, method")
    .eq("branch_id", branch.id)
    .order("period", { ascending: true })
    .limit(12);

  const lossSnapshots = (lossSnapshotsRaw as LossSnapshotRow[] | null) ?? [];
  const latestSnapshot = lossSnapshots[lossSnapshots.length - 1] ?? null;

  const realEvolution = lossSnapshots.map((s) => ({
    label: s.period.slice(0, 7),
    value: Number(s.compensation_total),
  }));
  const estimatedEvolution = lossSnapshots.map((s) => ({
    label: s.period.slice(0, 7),
    value: Number(s.estimated_review_loss),
  }));

  const byType: LossBreakdownItem[] = (latestSnapshot?.method?.by_compensation_type ?? []).map((t) => ({
    label: t.type_name,
    total: Number(t.total),
  }));
  const byReason: LossBreakdownItem[] = (latestSnapshot?.method?.by_reason_category ?? []).map((r) => ({
    label: r.reason_category,
    total: Number(r.total),
  }));

  const updateBranchWithId = updateBranch.bind(null, branch.id);
  const toggleActive = async () => {
    "use server";
    await toggleBranchActive(branch.id, !branch.is_active);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">{branch.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Evolución mensual de rating (últimos 90 días)</CardTitle>
        </CardHeader>
        <CardContent>
          {monthly.length > 0 ? (
            <TrendChart data={monthly} valueLabel="Rating" domain={[0, 5]} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin reviews en el período.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown por severidad</CardTitle>
        </CardHeader>
        <CardContent>
          {severity.length > 0 ? (
            <CategoryBarChart data={severity} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin reviews analizadas en el período.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Pérdidas</CardTitle>
          <MethodologyModal
            avgTicket={latestSnapshot?.method?.avg_ticket ?? null}
            affectedFactor={latestSnapshot?.method?.affected_factor ?? 1}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {latestSnapshot ? (
            <>
              <LossSummary
                compensationTotal={Number(latestSnapshot.compensation_total)}
                estimatedReviewLoss={Number(latestSnapshot.estimated_review_loss)}
                avgTicketConfigured={latestSnapshot.method?.avg_ticket != null}
              />
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Evolución mensual — pérdida real
                </p>
                <TrendChart data={realEvolution} valueLabel="Real" />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Evolución mensual — pérdida estimada
                </p>
                <TrendChart data={estimatedEvolution} valueLabel="Estimada" />
              </div>
              <LossBreakdown byType={byType} byReason={byReason} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no hay snapshots de pérdidas para esta sucursal. Recalculá desde Configuración.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviews críticas recientes (severidad 3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {criticalReviews.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay reviews críticas.</p>
          )}
          {criticalReviews.map((r) => (
            <div key={r.id} className="text-sm">
              <p className="text-xs text-muted-foreground">
                {r.author_name ?? "Anónimo"} · {r.review_date}
              </p>
              <p>{r.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas sincronizaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!syncJobs || syncJobs.length === 0) && (
            <p className="text-sm text-muted-foreground">
              Todavía no se sincronizó esta sucursal.
            </p>
          )}
          {(syncJobs ?? []).map((job) => (
            <div key={job.id} className="text-sm">
              <p className="text-xs text-muted-foreground">
                {new Date(job.started_at).toLocaleString("es-AR")}
              </p>
              {job.status === "failed" ? (
                <p className="text-destructive">Sync fallida: {job.error}</p>
              ) : job.status === "running" ? (
                <p className="text-muted-foreground">En curso...</p>
              ) : (
                <p>
                  Sync ok — {job.stats?.new ?? 0} reviews nuevas ({job.stats?.fetched ?? 0} traídas)
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editar sucursal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BranchForm
            action={updateBranchWithId}
            defaultValues={branch}
            submitLabel="Guardar cambios"
          />
          <form action={toggleActive}>
            <Button type="submit" variant="outline">
              {branch.is_active ? "Desactivar" : "Activar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
