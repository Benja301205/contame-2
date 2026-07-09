import { createClient } from "@supabase/supabase-js";
import { recomputeOrgLoss } from "@/lib/loss/engine";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ver .env.local)");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_NAME = "Pardo's Burgers";
const DEMO_PASSWORD = "Demo1234!";
const REVIEWS_PER_BRANCH = 250; // 6 sucursales × 250 = 1.500
const REVIEW_LOOKBACK_DAYS = 180; // ~6 meses
const CHECKIN_LOOKBACK_DAYS = 60;
const AVG_TICKET = 3500;

// Sucursal → categoría de problema dominante. La demo cuenta una historia:
// cada sucursal tiene un patrón propio, y sus compensaciones reales (check-in)
// coinciden con ese mismo motivo la mayoría de las veces — así el dashboard
// de patrones y el de pérdidas se explican entre sí.
const BRANCHES: { name: string; dominantCategory: string }[] = [
  { name: "Palermo", dominantCategory: "demora" },
  { name: "Belgrano", dominantCategory: "atencion" },
  { name: "Recoleta", dominantCategory: "calidad_comida" },
  { name: "Caballito", dominantCategory: "comida_fria" },
  { name: "Once", dominantCategory: "limpieza" },
  { name: "Flores", dominantCategory: "precio" },
];

const ALL_CATEGORIES = [
  "demora",
  "atencion",
  "calidad_comida",
  "comida_fria",
  "limpieza",
  "precio",
  "pedido_incorrecto",
  "ambiente",
  "otro",
];

function pickOtherCategory(exclude: string): string {
  const others = ALL_CATEGORIES.filter((c) => c !== exclude);
  return others[Math.floor(Math.random() * others.length)];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function insertBatches<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  batchSize = 500,
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + batchSize) as never);
    if (error) throw new Error(`Insert en ${table} falló: ${error.message}`);
  }
}

async function upsertUser(email: string, fullName: string, role: "admin" | "manager", orgId: string) {
  const {
    data: { users },
  } = await admin.auth.admin.listUsers();
  const existing = users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { org_id: orgId, role, full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

async function seedDemo() {
  const startedAt = Date.now();

  const { data: existingOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .maybeSingle();

  let orgId: string;
  if (existingOrg) {
    orgId = existingOrg.id;
    await admin.from("organizations").update({ avg_ticket: AVG_TICKET, affected_factor: 1 }).eq("id", orgId);
    console.log(`✔ org existente: ${ORG_NAME} (${orgId})`);
  } else {
    const { data: org, error } = await admin
      .from("organizations")
      .insert({ name: ORG_NAME, currency: "ARS", avg_ticket: AVG_TICKET, affected_factor: 1 })
      .select("id")
      .single();
    if (error) throw error;
    orgId = org!.id;
    console.log(`✔ org creada: ${ORG_NAME} (${orgId})`);
  }

  const adminId = await upsertUser("admin@pardosburgers.demo", "Admin Pardo's Burgers", "admin", orgId);

  const { data: compTypes } = await admin
    .from("compensation_types")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_active", true);
  const compensationTypeIds = (compTypes ?? []).map((t) => t.id);

  for (const branchDef of BRANCHES) {
    const slug = branchDef.name.toLowerCase();

    const { data: existingBranch } = await admin
      .from("branches")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", branchDef.name)
      .maybeSingle();

    let branchId: string;
    if (existingBranch) {
      branchId = existingBranch.id;
      // Sucursal ya sembrada en una corrida anterior: no duplicar datos.
      console.log(`✔ ${branchDef.name}: ya sembrada, se omite (idempotente)`);
      continue;
    }

    const { data: branch, error: branchError } = await admin
      .from("branches")
      .insert({ org_id: orgId, name: branchDef.name, google_place_id: `demo-${slug}` })
      .select("id")
      .single();
    if (branchError) throw branchError;
    branchId = branch!.id;

    const managerId = await upsertUser(
      `manager.${slug}@pardosburgers.demo`,
      `Gerente ${branchDef.name}`,
      "manager",
      orgId,
    );
    await admin.from("branch_managers").insert({ branch_id: branchId, profile_id: managerId });

    // --- Reviews + análisis sintético (nunca llama a Claude ni Apify) ---
    // Frases humanas por categoría: son lo que se LEE en la demo (quotes del
    // panel y cards de Reseñas) — nunca slugs.
    const NEGATIVE_PHRASES: Record<string, string[]> = {
      demora: [
        "Esperamos más de 40 minutos para que llegue la comida.",
        "Tardaron muchísimo en tomarnos el pedido, el lugar ni estaba lleno.",
        "Todo rico pero la demora fue exagerada.",
      ],
      atencion: [
        "Nos atendieron de mala gana, ni nos miraban.",
        "Pedimos la cuenta tres veces y nadie venía.",
        "El mozo nos trató pésimo, no volvemos.",
      ],
      calidad_comida: [
        "Las papas estaban recocidas y la hamburguesa sin gusto.",
        "La carne no estaba en su punto, muy decepcionante.",
        "Bajó mucho la calidad, antes era otra cosa.",
      ],
      comida_fria: [
        "La comida llegó fría, tuvimos que pedir que la recalienten.",
        "Las hamburguesas llegaron heladas, incomibles.",
        "Todo frío, se nota que quedó esperando en la cocina.",
      ],
      limpieza: [
        "El baño estaba sucio y la mesa pegajosa.",
        "Los vasos vinieron con marcas, da impresión.",
        "El piso del local estaba muy sucio.",
      ],
      precio: [
        "Muy caro para lo que ofrecen.",
        "Los precios subieron una barbaridad, no lo vale.",
        "Carísimo, hay mejores opciones por menos plata.",
      ],
      pedido_incorrecto: [
        "Pedí sin cebolla y vino con cebolla, tuve que devolverla.",
        "Me trajeron otro pedido y encima tardaron en cambiarlo.",
        "Faltaba la mitad de lo que pedimos por delivery.",
      ],
      ambiente: [
        "La música estaba tan fuerte que no podíamos hablar.",
        "Las mesas muy apretadas, incómodo para comer.",
        "Hacía un calor insoportable adentro del local.",
      ],
      otro: [
        "Mala experiencia en general, no volvería.",
        "Varias cosas para mejorar, no fue lo que esperaba.",
      ],
    };
    const POSITIVE_PHRASES = [
      "Excelente todo, volvemos seguro.",
      "Muy rica la comida y la atención de diez.",
      "Rápido, rico y buena onda. Recomendado.",
      "Gran experiencia, las mejores hamburguesas de la zona.",
    ];
    const CATEGORY_SUMMARY: Record<string, string> = {
      demora: "Queja por demoras en el servicio.",
      atencion: "Queja por mala atención del personal.",
      calidad_comida: "Queja por la calidad de la comida.",
      comida_fria: "Queja porque la comida llegó fría.",
      limpieza: "Queja por falta de limpieza.",
      precio: "Queja por precios altos.",
      pedido_incorrecto: "Queja por pedido equivocado o incompleto.",
      ambiente: "Queja por ruido o incomodidad del local.",
      otro: "Queja general sobre la experiencia.",
    };
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const reviewRows = [];
    const analysisRows = [];
    for (let i = 0; i < REVIEWS_PER_BRANCH; i++) {
      const reviewId = crypto.randomUUID();
      const isDominant = Math.random() < 0.65;
      const category = isDominant ? branchDef.dominantCategory : pickOtherCategory(branchDef.dominantCategory);
      const isNegative = isDominant || Math.random() < 0.25;
      const rating = isNegative ? (Math.random() < 0.5 ? 1 : 2) : Math.random() < 0.5 ? 4 : 5;
      const sentiment = isNegative ? "negative" : "positive";
      const severity = isNegative ? (Math.random() < 0.35 ? 3 : 2) : 1;

      reviewRows.push({
        id: reviewId,
        org_id: orgId,
        branch_id: branchId,
        provider_review_id: `demo-${slug}-${i}`,
        author_name: `Cliente ${i}`,
        rating,
        text: isNegative
          ? pick(NEGATIVE_PHRASES[category] ?? NEGATIVE_PHRASES.otro)
          : pick(POSITIVE_PHRASES),
        review_date: daysAgo(Math.floor(Math.random() * REVIEW_LOOKBACK_DAYS)),
        analysis_status: "done",
      });
      analysisRows.push({
        review_id: reviewId,
        sentiment,
        categories: isNegative ? [category] : [],
        severity,
        mentions_compensation: isNegative && Math.random() < 0.15,
        summary: isNegative
          ? (CATEGORY_SUMMARY[category] ?? CATEGORY_SUMMARY.otro)
          : "Reseña positiva.",
        model: "seed-demo:synthetic",
      });
    }
    await insertBatches("reviews", reviewRows);
    await insertBatches("review_analysis", analysisRows);

    // --- Check-ins coherentes con el patrón de la sucursal ---
    const checkinRows = [];
    for (let d = 0; d < CHECKIN_LOOKBACK_DAYS; d++) {
      checkinRows.push({
        org_id: orgId,
        branch_id: branchId,
        manager_id: managerId,
        checkin_date: daysAgo(d),
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    }
    const { data: insertedCheckins, error: checkinsError } = await admin
      .from("checkins")
      .insert(checkinRows)
      .select("id, checkin_date");
    if (checkinsError) throw checkinsError;

    const compensationItemRows = [];
    for (const checkin of insertedCheckins ?? []) {
      if (Math.random() < 0.5) continue; // la mitad de los días, sin compensaciones.

      const itemCount = Math.random() < 0.7 ? 1 : 2;
      for (let i = 0; i < itemCount; i++) {
        // Coherencia con el dashboard de patrones: el motivo de la
        // compensación real coincide con la categoría dominante de la
        // sucursal la mayoría de las veces.
        const reasonCategory =
          Math.random() < 0.75 ? branchDef.dominantCategory : pickOtherCategory(branchDef.dominantCategory);
        const typeId = compensationTypeIds[Math.floor(Math.random() * compensationTypeIds.length)];
        const quantity = 1 + Math.floor(Math.random() * 2);
        const unitCost = 500 + Math.floor(Math.random() * 10) * 100;

        compensationItemRows.push({
          checkin_id: checkin.id,
          type_id: typeId,
          quantity,
          unit_cost: unitCost,
          reason_category: reasonCategory,
        });
      }
    }
    await insertBatches("compensation_items", compensationItemRows);

    console.log(
      `✔ ${branchDef.name} (domina ${branchDef.dominantCategory}): ${REVIEWS_PER_BRANCH} reviews, ${checkinRows.length} check-ins, ${compensationItemRows.length} compensaciones`,
    );
  }

  console.log("\nRecalculando snapshots de pérdidas...");
  const lossResults = await recomputeOrgLoss(admin, orgId);
  const failed = lossResults.filter((r) => r.status === "failed");
  console.log(`✔ ${lossResults.length} snapshots (${failed.length} fallidos)`);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nListo en ${elapsed}s.`);
  console.log(`Admin: admin@pardosburgers.demo / ${DEMO_PASSWORD}`);
  console.log(`Gerentes: manager.<sucursal>@pardosburgers.demo / ${DEMO_PASSWORD}`);
  void adminId;
}

seedDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
