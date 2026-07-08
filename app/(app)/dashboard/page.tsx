import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getPeriodWindows, parsePeriod, type Period } from "@/lib/dashboard/period";
import { buildHeatmap, ratingTrend, topCategoriesForBranch, type CategoryStat } from "@/lib/dashboard/transform";
import { currentMonthPeriod } from "@/lib/loss/period";
import { PROBLEM_CATEGORIES } from "@/lib/analysis/classify";
import { CategoryBarChart } from "@/components/charts/category-bar";
import { Heatmap } from "@/components/charts/heatmap";
import { LossSummary } from "@/components/loss/loss-summary";
import { MethodologyModal } from "@/components/loss/methodology-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RatingSummaryRow = { branch_id: string; avg_rating: number | null; review_count: number };
type SentimentRow = { sentiment: string; review_count: number };

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
    category: r.sentiment,
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
    .select("avg_ticket, affected_factor")
    .eq("id", profile!.orgId)
    .single();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
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

      <div className="grid gap-4 md:grid-cols-2">
        {branchList.map((branch) => {
          const current = currentByBranch.get(branch.id);
          const previous = previousByBranch.get(branch.id);
          const trend = ratingTrend(
            current?.avg_rating != null ? Number(current.avg_rating) : null,
            previous?.avg_rating != null ? Number(previous.avg_rating) : null,
          );
          const top = topByBranch.get(branch.id) ?? [];

          return (
            <Card key={branch.id} data-testid={`branch-card-${branch.id}`}>
              <CardHeader>
                <CardTitle>{branch.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-2xl font-semibold">
                    {current?.avg_rating != null ? Number(current.avg_rating).toFixed(1) : "—"}
                  </span>
                  <span className="text-muted-foreground">({current?.review_count ?? 0} reviews)</span>
                  {trend.direction !== "flat" && (
                    <span className={trend.direction === "up" ? "text-emerald-600" : "text-red-600"}>
                      {trend.direction === "up" ? "▲" : "▼"} {Math.abs(trend.delta).toFixed(1)}
                    </span>
                  )}
                </div>

                {top.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Top problemas</p>
                    <CategoryBarChart data={top.map((t) => ({ category: t.category, count: t.currentCount }))} />
                    <ul className="space-y-1 text-xs">
                      {top.slice(0, 2).map((t) => {
                        const examples = examplesByPair.get(`${branch.id}:${t.category}`) ?? [];
                        return (
                          <li key={t.category}>
                            <span className="font-medium">{t.category}</span>{" "}
                            <span className={t.trend === "up" ? "text-red-600" : t.trend === "down" ? "text-emerald-600" : ""}>
                              ({t.trend === "up" ? "▲" : t.trend === "down" ? "▼" : "—"} vs. período anterior)
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Pérdidas — mes en curso</CardTitle>
          <MethodologyModal
            avgTicket={organization?.avg_ticket ?? null}
            affectedFactor={organization?.affected_factor ?? 1}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {lossRanking.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no hay snapshots de pérdidas para este mes. Recalculá desde Configuración.
            </p>
          )}
          {lossRanking.map(({ branch, loss }) => (
            <div
              key={branch.id}
              data-testid={`loss-row-${branch.id}`}
              className="border-b pb-3 last:border-0"
            >
              <p className="mb-1 text-sm font-medium">{branch.name}</p>
              <LossSummary
                compensationTotal={loss!.compensationTotal}
                estimatedReviewLoss={loss!.estimatedReviewLoss}
                avgTicketConfigured={organization?.avg_ticket != null}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="w-fit">
        <CardHeader>
          <CardTitle>Distribución de sentimiento</CardTitle>
        </CardHeader>
        <CardContent>
          {sentimentData.length > 0 ? (
            <CategoryBarChart data={sentimentData} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos en el período.</p>
          )}
        </CardContent>
      </Card>

      <Card className="w-fit">
        <CardHeader>
          <CardTitle>Heatmap sucursal × categoría</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Heatmap
            branchNames={branchList.map((b) => b.name)}
            categories={[...PROBLEM_CATEGORIES]}
            matrix={heatmapMatrix}
          />
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardContent className="py-4">
          <Link href="/dashboard/compliance" className="text-sm underline underline-offset-2">
            Cumplimiento de check-ins
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
