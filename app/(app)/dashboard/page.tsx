import Link from "next/link";
import type { CSSProperties } from "react";
import { StoreIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getPeriodWindows, parsePeriod, type Period } from "@/lib/dashboard/period";
import { buildHeatmap, ratingTrend, topCategoriesForBranch, type CategoryStat } from "@/lib/dashboard/transform";
import { branchVerdict } from "@/lib/dashboard/verdict";
import { currentMonthPeriod } from "@/lib/loss/period";
import { PROBLEM_CATEGORIES } from "@/lib/analysis/classify";
import { categoryLabel, SENTIMENT_LABELS, sentimentLabel } from "@/lib/labels";
import { formatRating } from "@/lib/format";
import { CategoryBarChart } from "@/components/charts/category-bar";
import { Heatmap } from "@/components/charts/heatmap";
import { LossHero } from "@/components/loss/loss-hero";
import { LossRankingBars } from "@/components/loss/loss-ranking-bars";
import { MethodologyModal } from "@/components/loss/methodology-modal";
import { Stars } from "@/components/stars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type RatingSummaryRow = { branch_id: string; avg_rating: number | null; review_count: number };
type SentimentRow = { sentiment: string; review_count: number };

/** Cada sentimiento ya tiene un significado semántico fijo en el resto de la
 * UI (chips de review-card) — a diferencia de las categorías de problema,
 * acá sí tiene sentido un color distinto por barra. */
const SENTIMENT_CHART_COLORS: Record<string, string> = {
  [SENTIMENT_LABELS.positive]: "#059669",
  [SENTIMENT_LABELS.neutral]: "#a3a3a3",
  [SENTIMENT_LABELS.negative]: "#dc2626",
};

const PERIODS: Period[] = [30, 90, 180];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodWindows(period);

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const branchList = branches ?? [];
  const branchIds = branchList.map((b) => b.id);

  const [currentRatings, previousRatings, categoryStatsRaw, sentimentRaw] = await Promise.all([
    supabase.rpc("branch_rating_summary", { p_org_id: profile!.orgId, p_start: currentStart, p_end: currentEnd }),
    supabase.rpc("branch_rating_summary", { p_org_id: profile!.orgId, p_start: previousStart, p_end: previousEnd }),
    supabase.rpc("branch_category_stats", {
      p_org_id: profile!.orgId,
      p_current_start: currentStart,
      p_current_end: currentEnd,
      p_previous_start: previousStart,
      p_previous_end: previousEnd,
    }),
    supabase.rpc("org_sentiment_distribution", { p_org_id: profile!.orgId, p_start: currentStart, p_end: currentEnd }),
  ]);

  const currentByBranch = new Map((currentRatings.data as RatingSummaryRow[] | null ?? []).map((r) => [r.branch_id, r]));
  const previousByBranch = new Map((previousRatings.data as RatingSummaryRow[] | null ?? []).map((r) => [r.branch_id, r]));

  const categoryStats: CategoryStat[] = ((categoryStatsRaw.data as
    | { branch_id: string; category: string; current_count: number; previous_count: number }[]
    | null) ?? []
  ).map((r) => ({
    branchId: r.branch_id,
    category: r.category,
    currentCount: r.current_count,
    previousCount: r.previous_count,
  }));

  const sentimentData = ((sentimentRaw.data as SentimentRow[] | null) ?? []).map((r) => ({
    category: sentimentLabel(r.sentiment),
    count: r.review_count,
  }));

  // Top 2 reviews de ejemplo por (sucursal, categoría) de los Top 5 mostrados.
  const topByBranch = new Map(branchIds.map((id) => [id, topCategoriesForBranch(categoryStats, id, 5)]));
  const examplePairs = branchIds.flatMap((branchId) =>
    (topByBranch.get(branchId) ?? []).map((t) => ({ branchId, category: t.category })),
  );
  const examplesEntries = await Promise.all(
    examplePairs.map(async ({ branchId, category }) => {
      const { data } = await supabase
        .from("reviews")
        .select("author_name, text, review_analysis!inner(categories)")
        .eq("branch_id", branchId)
        .gte("review_date", currentStart)
        .lt("review_date", currentEnd)
        .contains("review_analysis.categories", [category])
        .limit(2);
      return { key: `${branchId}:${category}`, examples: data ?? [] };
    }),
  );
  const examplesByPair = new Map(examplesEntries.map((e) => [e.key, e.examples]));

  const heatmapMatrix = buildHeatmap(categoryStats, branchIds, [...PROBLEM_CATEGORIES]);

  const { data: organization } = await supabase
    .from("organizations")
    .select("currency, avg_ticket, affected_factor")
    .eq("id", profile!.orgId)
    .single();
  const currency = organization?.currency ?? "ARS";

  const { data: lossSnapshots } = await supabase
    .from("loss_snapshots")
    .select("branch_id, compensation_total, estimated_review_loss")
    .eq("period", currentMonthPeriod());

  const lossByBranch = new Map(
    (lossSnapshots ?? []).map((s) => [
      s.branch_id,
      { compensationTotal: Number(s.compensation_total), estimatedReviewLoss: Number(s.estimated_review_loss) },
    ]),
  );
  const lossRanking = branchList
    .map((b) => ({ branch: b, loss: lossByBranch.get(b.id) }))
    .filter((r) => r.loss)
    .sort(
      (a, b) =>
        b.loss!.compensationTotal + b.loss!.estimatedReviewLoss - (a.loss!.compensationTotal + a.loss!.estimatedReviewLoss),
    );

  const totalReal = lossRanking.reduce((sum, r) => sum + r.loss!.compensationTotal, 0);
  const totalEstimated = lossRanking.reduce((sum, r) => sum + r.loss!.estimatedReviewLoss, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Panel</h1>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/dashboard?period=${p}`}
              className={`rounded-md border px-3 py-1 text-sm ${
                p === period ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {p} días
            </Link>
          ))}
        </div>
      </div>

      {/* (a) La plata primero: héroe de pérdidas del mes, siempre arriba de todo.
          Nivel "elevated" (shadow-md + ring más marcado): esta card domina la página.
          panel-enter sin delay: es el LCP, entra primero y sin esperar. */}
      <Card className="panel-enter shadow-md ring-foreground/[0.08] sm:py-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="sr-only">Pérdidas del mes</CardTitle>
          <div />
          <MethodologyModal
            avgTicket={organization?.avg_ticket ?? null}
            affectedFactor={organization?.affected_factor ?? 1}
            currency={currency}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          {lossRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay datos de pérdidas para este mes. Recalculá desde Configuración.
            </p>
          ) : (
            <>
              <LossHero totalReal={totalReal} totalEstimated={totalEstimated} currency={currency} />
              <div>
                <p className="mb-3 text-sm font-medium">Sucursales, de mayor a menor pérdida</p>
                <LossRankingBars
                  items={lossRanking.map((r) => ({
                    branchId: r.branch.id,
                    branchName: r.branch.name,
                    compensationTotal: r.loss!.compensationTotal,
                    estimatedReviewLoss: r.loss!.estimatedReviewLoss,
                  }))}
                  currency={currency}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {branchList.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <StoreIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay sucursales activas</EmptyTitle>
            <EmptyDescription>
              Creá la primera para empezar a ver patrones y pérdidas por sucursal.
            </EmptyDescription>
          </EmptyHeader>
          <Link href="/branches" className="text-sm underline underline-offset-2">
            Crear sucursal
          </Link>
        </Empty>
      )}

      {/* (b) Veredicto por sucursal + (c) charts, dentro de cada card. */}
      <div
        className="panel-enter grid gap-4 md:grid-cols-2"
        style={{ "--panel-enter-delay": "50ms" } as CSSProperties}
      >
        {branchList.map((branch) => {
          const current = currentByBranch.get(branch.id);
          const previous = previousByBranch.get(branch.id);
          const trend = ratingTrend(
            current?.avg_rating != null ? Number(current.avg_rating) : null,
            previous?.avg_rating != null ? Number(previous.avg_rating) : null,
          );
          const top = topByBranch.get(branch.id) ?? [];

          return (
            <Card
              key={branch.id}
              data-testid={`branch-card-${branch.id}`}
              className="transition-shadow duration-150 hover:shadow-md"
            >
              <CardHeader>
                <CardTitle>{branch.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  {current?.avg_rating != null ? (
                    <>
                      <Stars rating={Number(current.avg_rating)} />
                      <span className="font-semibold">{formatRating(Number(current.avg_rating))}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin ratings en el período</span>
                  )}
                  <span className="text-muted-foreground">({current?.review_count ?? 0} reseñas)</span>
                  {current?.avg_rating != null &&
                    (trend.direction === "flat" || Math.abs(trend.delta) < 0.05 ? (
                      <span className="text-muted-foreground">sin cambios</span>
                    ) : (
                      <span className={trend.direction === "up" ? "text-emerald-700" : "text-red-700"}>
                        {trend.direction === "up" ? "▲" : "▼"} {Math.abs(trend.delta).toFixed(1)}
                      </span>
                    ))}
                </div>

                <p className="text-sm">{branchVerdict(top[0])}</p>

                {top.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Problemas más frecuentes</p>
                    <CategoryBarChart
                      data={top.map((t) => ({ category: categoryLabel(t.category), count: t.currentCount }))}
                    />
                    <ul className="space-y-1 text-xs">
                      {top.slice(0, 2).map((t) => {
                        const examples = examplesByPair.get(`${branch.id}:${t.category}`) ?? [];
                        return (
                          <li key={t.category}>
                            <span className="font-medium">{categoryLabel(t.category)}</span>{" "}
                            <span className={t.trend === "up" ? "text-red-700" : t.trend === "down" ? "text-emerald-700" : "text-muted-foreground"}>
                              ({t.trend === "up" ? "▲ empeoró" : t.trend === "down" ? "▼ mejoró" : "sin cambios"} vs.
                              período anterior)
                            </span>
                            {examples.map((ex, i) => (
                              <p key={i} className="pl-2 text-muted-foreground">
                                “{ex.text?.slice(0, 80)}” — {ex.author_name ?? "Anónimo"}
                              </p>
                            ))}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin problemas detectados en el período.</p>
                )}

                <Link
                  href={`/branches/${branch.id}`}
                  className="text-xs underline underline-offset-2"
                >
                  Ver detalle de sucursal
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card
        className="panel-enter w-full max-w-md"
        style={{ "--panel-enter-delay": "100ms" } as CSSProperties}
      >
        <CardHeader>
          <CardTitle>Distribución de sentimiento</CardTitle>
        </CardHeader>
        <CardContent>
          {sentimentData.length > 0 ? (
            <CategoryBarChart data={sentimentData} colors={SENTIMENT_CHART_COLORS} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos en el período.</p>
          )}
        </CardContent>
      </Card>

      <Card className="panel-enter w-fit" style={{ "--panel-enter-delay": "150ms" } as CSSProperties}>
        <CardHeader>
          <CardTitle>Problemas por sucursal</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Heatmap
            branchNames={branchList.map((b) => b.name)}
            categories={[...PROBLEM_CATEGORIES]}
            matrix={heatmapMatrix}
          />
        </CardContent>
      </Card>

      <Card
        className="panel-enter max-w-md"
        style={{ "--panel-enter-delay": "150ms" } as CSSProperties}
      >
        <CardContent className="py-4">
          <Link href="/dashboard/compliance" className="text-sm underline underline-offset-2">
            Cumplimiento de registros diarios
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
