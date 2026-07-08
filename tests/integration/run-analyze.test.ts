import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS } from "@/lib/seed-data";
import { runAnalyzeForPending } from "@/lib/analysis/run-analyze";
import type { ReviewToClassify } from "@/lib/analysis/classify";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type FakeResultItem = {
  review_id: string;
  sentiment: "positive" | "neutral" | "negative";
  categories: string[];
  severity: 1 | 2 | 3;
  mentions_compensation: boolean;
  summary: string;
};

function fakeAnthropic(handler: (reviews: ReviewToClassify[]) => FakeResultItem[]) {
  let calls = 0;
  const client = {
    messages: {
      create: async (params: { messages: Array<{ content: string }> }) => {
        calls++;
        // El prompt real incluye "id: <uuid>" por review; para no acoplar el
        // mock al formato exacto del prompt, el handler recibe los reviews
        // vía un canal aparte en cada test (closure), no parseando el texto.
        const results = handler([]);
        return { content: [{ type: "text", text: JSON.stringify({ results }) }] };
      },
    },
  };
  return { client, getCalls: () => calls };
}

describe("runAnalyzeForPending", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgId: string;
  let branchId: string;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("name", SEED_ORGS[0].name)
      .single();
    orgId = org!.id;

    const suffix = Math.random().toString(36).slice(2, 8);
    const { data: branch } = await admin
      .from("branches")
      .insert({ org_id: orgId, name: `Sucursal analyze ${suffix}`, google_place_id: `place-an-${suffix}` })
      .select("id")
      .single();
    branchId = branch!.id;
  });

  async function insertReview(overrides: {
    providerReviewId: string;
    rating: number;
    text: string | null;
  }) {
    const { data } = await admin
      .from("reviews")
      .insert({
        org_id: orgId,
        branch_id: branchId,
        provider_review_id: overrides.providerReviewId,
        author_name: "Cliente",
        rating: overrides.rating,
        text: overrides.text,
        review_date: "2026-06-01",
      })
      .select("id")
      .single();
    return data!.id as string;
  }

  it("clasifica reviews con texto vacío por rating, sin llamar al modelo", async () => {
    const id = await insertReview({ providerReviewId: `empty-${Date.now()}`, rating: 1, text: "" });

    const { client, getCalls } = fakeAnthropic(() => {
      throw new Error("no debería llamarse al modelo para texto vacío");
    });

    const { body } = await runAnalyzeForPending(admin, client as never, { branchId });

    expect(getCalls()).toBe(0);
    const result = body.results!.find((r) => r.reviewId === id);
    expect(result).toMatchObject({ status: "done" });

    const { data: analysis } = await admin
      .from("review_analysis")
      .select("sentiment, categories")
      .eq("review_id", id)
      .single();
    expect(analysis).toMatchObject({ sentiment: "negative", categories: [] });

    const { data: review } = await admin.from("reviews").select("analysis_status").eq("id", id).single();
    expect(review!.analysis_status).toBe("done");
  });

  it("clasifica reviews con texto vía el modelo (mockeado) y guarda el resultado", async () => {
    const id = await insertReview({
      providerReviewId: `withtext-${Date.now()}`,
      rating: 2,
      text: "La comida tardó mucho en llegar.",
    });

    const { client } = fakeAnthropic(() => [
      {
        review_id: id,
        sentiment: "negative",
        categories: ["demora"],
        severity: 2,
        mentions_compensation: false,
        summary: "Demora en la entrega.",
      },
    ]);

    const { body } = await runAnalyzeForPending(admin, client as never, { branchId });

    const result = body.results!.find((r) => r.reviewId === id);
    expect(result).toMatchObject({ status: "done" });

    const { data: analysis } = await admin
      .from("review_analysis")
      .select("sentiment, categories, model")
      .eq("review_id", id)
      .single();
    expect(analysis!.sentiment).toBe("negative");
    expect(analysis!.categories).toEqual(["demora"]);
    expect(analysis!.model).toContain("claude-haiku-4-5");
  });

  it("una review sin resultado en la respuesta del modelo se marca failed, sin afectar al resto del lote", async () => {
    const idOk = await insertReview({
      providerReviewId: `partial-ok-${Date.now()}`,
      rating: 5,
      text: "Todo excelente.",
    });
    const idMissing = await insertReview({
      providerReviewId: `partial-missing-${Date.now()}`,
      rating: 3,
      text: "Estuvo bien nomás.",
    });

    const { client } = fakeAnthropic(() => [
      {
        review_id: idOk,
        sentiment: "positive",
        categories: [],
        severity: 1,
        mentions_compensation: false,
        summary: "Muy bueno.",
      },
      // idMissing no viene en la respuesta.
    ]);

    const { body } = await runAnalyzeForPending(admin, client as never, { branchId });

    const results = body.results!;
    expect(results.find((r) => r.reviewId === idOk)).toMatchObject({ status: "done" });
    expect(results.find((r) => r.reviewId === idMissing)).toMatchObject({ status: "failed" });

    const { data: reviewMissing } = await admin
      .from("reviews")
      .select("analysis_status")
      .eq("id", idMissing)
      .single();
    expect(reviewMissing!.analysis_status).toBe("failed");
  });

  it("reintenta hasta 2 veces si el modelo falla, y marca failed si sigue fallando", async () => {
    const id = await insertReview({
      providerReviewId: `retry-fail-${Date.now()}`,
      rating: 2,
      text: "Nunca vino el mozo.",
    });

    let attempts = 0;
    const client = {
      messages: {
        create: async () => {
          attempts++;
          throw new Error("Timeout del provider");
        },
      },
    };

    const { body } = await runAnalyzeForPending(admin, client as never, { branchId });

    expect(attempts).toBe(2);
    expect(body.results!.find((r) => r.reviewId === id)).toMatchObject({ status: "failed" });
  });

  it("nunca reprocesa una review que ya está 'done'", async () => {
    const id = await insertReview({
      providerReviewId: `no-reproc-${Date.now()}`,
      rating: 5,
      text: "Buenísimo.",
    });

    let calls = 0;
    const client = {
      messages: {
        create: async () => {
          calls++;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  results: [
                    {
                      review_id: id,
                      sentiment: "positive",
                      categories: [],
                      severity: 1,
                      mentions_compensation: false,
                      summary: "Buenísimo.",
                    },
                  ],
                }),
              },
            ],
          };
        },
      },
    };

    await runAnalyzeForPending(admin, client as never, { branchId });
    expect(calls).toBe(1);

    const { body } = await runAnalyzeForPending(admin, client as never, { branchId });
    expect(body.results).toEqual(
      expect.arrayContaining([]),
    );
    expect(body.results!.some((r) => r.reviewId === id)).toBe(false);
    expect(calls).toBe(1);
  });

  it("hace lotes de a lo sumo 20 reviews con texto por llamada al modelo", async () => {
    const suffix = Date.now();
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      ids.push(await insertReview({ providerReviewId: `batch-${suffix}-${i}`, rating: 4, text: `Reseña ${i}` }));
    }

    let calls = 0;
    const batchSizes: number[] = [];
    const client = {
      messages: {
        create: async (params: { messages: Array<{ content: string }> }) => {
          calls++;
          const promptText = params.messages[0].content;
          const idsInPrompt = [...promptText.matchAll(/- id: ([0-9a-f-]{36})/g)].map((m) => m[1]);
          batchSizes.push(idsInPrompt.length);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  results: idsInPrompt.map((reviewId) => ({
                    review_id: reviewId,
                    sentiment: "positive",
                    categories: [],
                    severity: 1,
                    mentions_compensation: false,
                    summary: "Ok.",
                  })),
                }),
              },
            ],
          };
        },
      },
    };

    const { body } = await runAnalyzeForPending(admin, client as never, { branchId, limit: 25 });

    expect(calls).toBe(2);
    expect(batchSizes).toEqual([20, 5]);
    expect(ids.every((id) => body.results!.find((r) => r.reviewId === id)?.status === "done")).toBe(true);
  });
});
