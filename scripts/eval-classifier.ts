import { writeFileSync, mkdirSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { GOLDEN_SET } from "./golden-set";
import { classifyByRatingOnly, classifyBatch, type ClassificationResult } from "@/lib/analysis/classify";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("Falta ANTHROPIC_API_KEY (ver .env.local)");
}

const client = new Anthropic({ apiKey });

async function run() {
  const emptyText = GOLDEN_SET.filter((c) => !c.text.trim());
  const withText = GOLDEN_SET.filter((c) => c.text.trim());

  const resultsById = new Map<string, ClassificationResult>();
  for (const c of emptyText) {
    resultsById.set(c.id, classifyByRatingOnly(c.id, c.rating));
  }

  const rawResponses: unknown[] = [];

  // Interceptamos la llamada cruda para poder guardar la respuesta tal cual
  // la devolvió la API, además del resultado ya parseado por classifyBatch.
  const originalCreate = client.messages.create.bind(client.messages);
  client.messages.create = (async (params: Anthropic.MessageCreateParamsNonStreaming) => {
    const response = await originalCreate(params);
    rawResponses.push(response);
    return response;
  }) as typeof client.messages.create;

  if (withText.length > 0) {
    const parsed = await classifyBatch(
      client,
      withText.map((c) => ({ id: c.id, rating: c.rating, text: c.text })),
    );
    for (const [id, result] of parsed.valid) {
      resultsById.set(id, result);
    }
    if (parsed.invalid.length > 0) {
      console.error("Items inválidos en la respuesta del modelo:", parsed.invalid);
    }
  }

  let sentimentHits = 0;
  let categoryHits = 0;
  let compensationChecked = 0;
  let compensationHits = 0;

  const rows = GOLDEN_SET.map((c) => {
    const actual = resultsById.get(c.id);
    const sentimentMatch = actual?.sentiment === c.expectedSentiment;
    const categoryMatch =
      c.expectedCategory === null
        ? (actual?.categories.length ?? -1) === 0
        : (actual?.categories.includes(c.expectedCategory) ?? false);

    if (sentimentMatch) sentimentHits++;
    if (categoryMatch) categoryHits++;

    let compensationNote = "";
    if (c.expectedMentionsCompensation !== undefined) {
      compensationChecked++;
      const hit = actual?.mentionsCompensation === c.expectedMentionsCompensation;
      if (hit) compensationHits++;
      compensationNote = hit ? "✔ compensación OK" : `✘ compensación esperado=${c.expectedMentionsCompensation} obtenido=${actual?.mentionsCompensation}`;
    }

    return {
      id: c.id,
      note: c.note,
      expectedSentiment: c.expectedSentiment,
      actualSentiment: actual?.sentiment ?? "(sin resultado)",
      sentimentMatch,
      expectedCategory: c.expectedCategory ?? "(ninguna)",
      actualCategories: actual?.categories.join(",") || "(ninguna)",
      categoryMatch,
      compensationNote,
    };
  });

  console.table(
    rows.map((r) => ({
      id: r.id,
      sentiment_ok: r.sentimentMatch ? "✔" : "✘",
      esperado: r.expectedSentiment,
      obtenido: r.actualSentiment,
      categoria_ok: r.categoryMatch ? "✔" : "✘",
      cat_esperada: r.expectedCategory,
      cat_obtenida: r.actualCategories,
    })),
  );

  console.log(`\nSentimiento correcto: ${sentimentHits}/${GOLDEN_SET.length} (umbral: ≥13/15)`);
  console.log(`Categoría principal correcta: ${categoryHits}/${GOLDEN_SET.length} (umbral: ≥12/15)`);

  if (compensationChecked > 0) {
    console.log(
      `\nmentions_compensation (solo informativo, no cuenta para el umbral): ${compensationHits}/${compensationChecked}`,
    );
    for (const r of rows) {
      if (r.compensationNote) console.log(`  [${r.id}] ${r.compensationNote}`);
    }
  }

  mkdirSync("scratch", { recursive: true });
  writeFileSync(
    "scratch/eval-results.json",
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        summary: {
          sentimentHits,
          categoryHits,
          total: GOLDEN_SET.length,
          compensationHits,
          compensationChecked,
        },
        rows,
        rawApiResponses: rawResponses,
      },
      null,
      2,
    ),
  );
  console.log("\nOutput crudo guardado en scratch/eval-results.json");

  const passed = sentimentHits >= 13 && categoryHits >= 12;
  console.log(passed ? "\n✅ Umbrales del criterio 2 cumplidos." : "\n❌ Umbrales del criterio 2 NO cumplidos.");
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
