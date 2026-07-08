process.loadEnvFile(`${process.cwd()}/.env.local`);

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";
import { todayInBuenosAires } from "@/lib/checkins/today";

const ADMIN_EMAIL = `admin.${SEED_ORGS[0].slug}@contame.test`;

test("admin cambia avg_ticket, recalcula, y el dashboard refleja el cambio", async ({ page }) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("name", SEED_ORGS[0].name)
    .single();

  const { data: managerProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", org!.id)
    .eq("full_name", `Gerente ${SEED_ORGS[0].name}`)
    .single();

  const { data: compType } = await admin
    .from("compensation_types")
    .select("id")
    .eq("org_id", org!.id)
    .eq("name", "Descuento")
    .single();

  const runId = `${Date.now()}`;
  const { data: branch } = await admin
    .from("branches")
    .insert({ org_id: org!.id, name: `Sucursal Loss E2E ${runId}`, google_place_id: `place-loss-${runId}` })
    .select("id")
    .single();

  const today = todayInBuenosAires();

  // 1 review negativa este mes -> con avg_ticket configurado, aporta a la estimación.
  const { data: review } = await admin
    .from("reviews")
    .insert({
      org_id: org!.id,
      branch_id: branch!.id,
      provider_review_id: `loss-e2e-${runId}`,
      rating: 1,
      text: "Muy mala atención",
      review_date: today,
    })
    .select("id")
    .single();
  await admin.from("review_analysis").insert({
    review_id: review!.id,
    sentiment: "negative",
    categories: ["atencion"],
    severity: 2,
    mentions_compensation: false,
    summary: "fixture",
    model: "test",
  });

  // 1 checkin con compensación real este mes.
  const { data: checkin } = await admin
    .from("checkins")
    .insert({
      org_id: org!.id,
      branch_id: branch!.id,
      manager_id: managerProfile!.id,
      checkin_date: today,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  await admin.from("compensation_items").insert({
    checkin_id: checkin!.id,
    type_id: compType!.id,
    quantity: 1,
    unit_cost: 250,
    reason_category: "atencion",
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL("http://127.0.0.1:3000/");

  await page.goto("/settings");
  const lossParamsCard = page.getByTestId("loss-params-card");
  await lossParamsCard.getByLabel("Ticket promedio").fill("2000");
  await lossParamsCard.getByLabel("Factor de clientes afectados").fill("1");
  await lossParamsCard.getByRole("button", { name: "Guardar" }).click();
  // Espera a que el submit del server action termine (el botón vuelve a "Guardar").
  await expect(lossParamsCard.getByRole("button", { name: "Guardar" })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Ticket promedio")).toHaveValue("2000");

  await page.getByRole("button", { name: "Recalcular pérdidas" }).click();
  await expect(page.getByText(/Recalculado: \d+ snapshots\./)).toBeVisible();

  await page.goto("/dashboard");
  const branchRow = page.getByTestId(`loss-row-${branch!.id}`);
  await expect(branchRow.getByText("Pérdida real (check-ins)")).toBeVisible();
  await expect(branchRow.getByText("$250")).toBeVisible();
  // 1 review negativa × 2000 × 1 = 2000 (es-AR usa "." como separador de miles)
  await expect(branchRow.getByText("$2.000")).toBeVisible();
});
