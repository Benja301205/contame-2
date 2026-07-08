import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ver .env.local)");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CATEGORIES = [
  "demora",
  "atencion",
  "calidad_comida",
  "comida_fria",
  "limpieza",
  "precio",
  "pedido_incorrecto",
  "ambiente",
  "otro",
] as const;

const REVIEWS_PER_BRANCH = 1000;
const BRANCH_COUNT = 5;
const LOOKBACK_DAYS = 200;

/**
 * Seed de volumen puramente sintético para medir el criterio de aceptación
 * 4 del Loop 5 (carga del dashboard <2s con 5.000 reviews). NUNCA llama a
 * la API de Claude — el análisis se genera con reglas simples en código,
 * gratis y en segundos. Cada sucursal tiene una categoría "dominante" para
 * que el criterio 1 (patrones distinguibles por sucursal) sea verificable
 * a simple vista en el dashboard.
 */
function randomDate(): string {
  const daysAgo = Math.floor(Math.random() * LOOKBACK_DAYS);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function pickOtherCategory(exclude: string): string {
  const others = CATEGORIES.filter((c) => c !== exclude);
  return others[Math.floor(Math.random() * others.length)];
}

async function insertBatches<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  batchSize = 500,
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await admin.from(table).insert(batch as never);
    if (error) throw new Error(`Insert en ${table} falló: ${error.message}`);
  }
}

async function seedVolume() {
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("name", "Sabor Porteño")
    .single();
  if (!org) throw new Error("Corré 'npm run seed' primero (falta la org Sabor Porteño).");

  const runId = Date.now();
  const branches: { id: string; dominantCategory: (typeof CATEGORIES)[number] }[] = [];

  for (let b = 0; b < BRANCH_COUNT; b++) {
    const dominantCategory = CATEGORIES[b % CATEGORIES.length];
    const { data: branch, error } = await admin
      .from("branches")
      .insert({
        org_id: org.id,
        name: `Volumen ${b + 1} (domina ${dominantCategory})`,
        google_place_id: `volume-${runId}-${b}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    branches.push({ id: branch!.id, dominantCategory });
  }

  let totalReviews = 0;
  const startedAt = Date.now();

  for (const branch of branches) {
    const reviewRows = [];
    const analysisRows = [];

    for (let i = 0; i < REVIEWS_PER_BRANCH; i++) {
      const reviewId = crypto.randomUUID();
      const isDominant = Math.random() < 0.7;
      const category = isDominant ? branch.dominantCategory : pickOtherCategory(branch.dominantCategory);
      const isNegative = isDominant || Math.random() < 0.3;
      const rating = isNegative ? (Math.random() < 0.5 ? 1 : 2) : Math.random() < 0.5 ? 4 : 5;
      const sentiment = isNegative ? "negative" : "positive";
      const severity = isNegative ? (Math.random() < 0.4 ? 3 : 2) : 1;

      reviewRows.push({
        id: reviewId,
        org_id: org.id,
        branch_id: branch.id,
        provider_review_id: `volume-${runId}-${branch.id}-${i}`,
        author_name: `Cliente ${i}`,
        rating,
        text: isNegative
          ? `Problema de ${category}: reseña sintética #${i}.`
          : `Todo bien, reseña sintética #${i}.`,
        review_date: randomDate(),
        analysis_status: "done",
      });

      analysisRows.push({
        review_id: reviewId,
        sentiment,
        categories: isNegative ? [category] : [],
        severity,
        mentions_compensation: isNegative && Math.random() < 0.15,
        summary: isNegative ? `Reseña sintética de ${category}.` : "Reseña sintética positiva.",
        model: "seed-volume:synthetic",
      });
    }

    await insertBatches("reviews", reviewRows);
    await insertBatches("review_analysis", analysisRows);
    totalReviews += reviewRows.length;
    console.log(`✔ ${branch.dominantCategory}: ${reviewRows.length} reviews insertadas`);
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nListo: ${totalReviews} reviews sintéticas en ${BRANCH_COUNT} sucursales, en ${elapsedSeconds}s.`);
}

seedVolume().catch((err) => {
  console.error(err);
  process.exit(1);
});
