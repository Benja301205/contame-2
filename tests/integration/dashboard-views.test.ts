import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS } from "@/lib/seed-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe("funciones de agregación del dashboard (Loop 5) vs. cálculo manual", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgId: string;
  let branchId: string;
  let sentimentBaseline: Map<string, number>;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("name", SEED_ORGS[0].name)
      .single();
    orgId = org!.id;

    // org_sentiment_distribution es a nivel organización (no acota por
    // sucursal, es su diseño para el chart del dashboard) y otros archivos
    // de test reutilizan fechas fijas de junio 2026 como fixtures — se
    // captura la base ANTES de insertar, y el test de más abajo compara
    // por delta en vez de asumir exclusividad de la ventana.
    const { data: baselineData } = await admin.rpc("org_sentiment_distribution", {
      p_org_id: orgId,
      p_start: "2026-06-01",
      p_end: "2026-07-01",
    });
    sentimentBaseline = new Map(
      (baselineData ?? []).map((r: { sentiment: string; review_count: number }) => [r.sentiment, r.review_count]),
    );

    const suffix = Math.random().toString(36).slice(2, 8);
    const { data: branch } = await admin
      .from("branches")
      .insert({ org_id: orgId, name: `Sucursal views ${suffix}`, google_place_id: `place-views-${suffix}` })
      .select("id")
      .single();
    branchId = branch!.id;

    // Ventana "actual": 2026-06-01..2026-06-30. Ventana "anterior": 2026-05-01..2026-05-31.
    const fixtures = [
      // rating, date, sentiment, categories, severity
      { rating: 5, date: "2026-06-05", sentiment: "positive", categories: [], severity: 1 },
      { rating: 1, date: "2026-06-10", sentiment: "negative", categories: ["demora"], severity: 3 },
      { rating: 2, date: "2026-06-15", sentiment: "negative", categories: ["demora", "atencion"], severity: 2 },
      { rating: 3, date: "2026-06-20", sentiment: "neutral", categories: ["precio"], severity: 1 },
      // período anterior
      { rating: 4, date: "2026-05-10", sentiment: "positive", categories: [], severity: 1 },
      { rating: 1, date: "2026-05-15", sentiment: "negative", categories: ["demora"], severity: 3 },
      // fuera de ambas ventanas
      { rating: 5, date: "2026-01-01", sentiment: "positive", categories: [], severity: 1 },
    ];

    for (const [i, f] of fixtures.entries()) {
      const { data: review } = await admin
        .from("reviews")
        .insert({
          org_id: orgId,
          branch_id: branchId,
          provider_review_id: `views-${suffix}-${i}`,
          rating: f.rating,
          text: `fixture ${i}`,
          review_date: f.date,
        })
        .select("id")
        .single();

      await admin.from("review_analysis").insert({
        review_id: review!.id,
        sentiment: f.sentiment,
        categories: f.categories,
        severity: f.severity,
        mentions_compensation: false,
        summary: "fixture",
        model: "test",
      });
    }
  });

  it("branch_rating_summary coincide con el promedio calculado a mano", async () => {
    const { data } = await admin.rpc("branch_rating_summary", {
      p_org_id: orgId,
      p_start: "2026-06-01",
      p_end: "2026-07-01",
    });
    const row = data!.find((r: { branch_id: string }) => r.branch_id === branchId);

    // (5 + 1 + 2 + 3) / 4 = 2.75
    expect(row.review_count).toBe(4);
    expect(Number(row.avg_rating)).toBeCloseTo(2.75, 2);
  });

  it("branch_category_stats distingue período actual vs. anterior", async () => {
    const { data } = await admin.rpc("branch_category_stats", {
      p_org_id: orgId,
      p_current_start: "2026-06-01",
      p_current_end: "2026-07-01",
      p_previous_start: "2026-05-01",
      p_previous_end: "2026-06-01",
    });
    const rows = data!.filter((r: { branch_id: string }) => r.branch_id === branchId);

    const demora = rows.find((r: { category: string }) => r.category === "demora");
    expect(demora.current_count).toBe(2); // reviews del 10 y 15 de junio
    expect(demora.previous_count).toBe(1); // review del 15 de mayo

    const atencion = rows.find((r: { category: string }) => r.category === "atencion");
    expect(atencion.current_count).toBe(1);
    expect(atencion.previous_count).toBe(0);
  });

  it("branch_severity_breakdown cuenta por severidad en la ventana", async () => {
    const { data } = await admin.rpc("branch_severity_breakdown", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_start: "2026-06-01",
      p_end: "2026-07-01",
    });

    const bySeverity = new Map(data!.map((r: { severity: number; review_count: number }) => [r.severity, r.review_count]));
    expect(bySeverity.get(1)).toBe(2); // rating 5 (severity1) + rating 3 (severity1)
    expect(bySeverity.get(2)).toBe(1);
    expect(bySeverity.get(3)).toBe(1);
  });

  it("org_sentiment_distribution cuenta por sentimiento en la ventana", async () => {
    const { data } = await admin.rpc("org_sentiment_distribution", {
      p_org_id: orgId,
      p_start: "2026-06-01",
      p_end: "2026-07-01",
    });

    const bySentiment = new Map(data!.map((r: { sentiment: string; review_count: number }) => [r.sentiment, r.review_count]));
    const delta = (sentiment: string) => (bySentiment.get(sentiment) ?? 0) - (sentimentBaseline.get(sentiment) ?? 0);

    expect(delta("positive")).toBe(1);
    expect(delta("negative")).toBe(2);
    expect(delta("neutral")).toBe(1);
  });

  it("branch_rating_monthly agrupa por mes calendario", async () => {
    const { data } = await admin.rpc("branch_rating_monthly", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_since: "2026-05-01",
    });

    const june = data!.find((r: { month: string }) => r.month.startsWith("2026-06"));
    const may = data!.find((r: { month: string }) => r.month.startsWith("2026-05"));

    expect(june.review_count).toBe(4);
    expect(may.review_count).toBe(2);
  });
});
