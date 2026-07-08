process.loadEnvFile(`${process.cwd()}/.env.local`);

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";
import { todayInBuenosAires } from "@/lib/checkins/today";

const ADMIN_EMAIL = `admin.${SEED_ORGS[0].slug}@contame.test`;

test("el dashboard renderiza con datos y el filtro de período cambia los valores", async ({ page }) => {
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

  const runId = `${Date.now()}`;
  const { data: branch } = await admin
    .from("branches")
    .insert({ org_id: org!.id, name: `Sucursal Dashboard E2E ${runId}`, google_place_id: `place-dash-${runId}` })
    .select("id")
    .single();

  // Una review dentro de los últimos 30 días (aparece con período=30) y otra
  // solo dentro de los últimos 180 (para que el filtro cambie el conteo).
  // "Hoy" se calcula en huso horario argentino, igual que el server
  // (lib/checkins/today.ts) — un new Date() UTC crudo puede caer un día
  // adelante de "hoy" en Buenos Aires y quedar fuera de la ventana.
  const today = todayInBuenosAires();
  const oldDate = new Date(`${today}T00:00:00Z`);
  oldDate.setUTCDate(oldDate.getUTCDate() - 100);
  const dates = [today, oldDate.toISOString().slice(0, 10)];

  for (const [i, date] of dates.entries()) {
    const { data: review } = await admin
      .from("reviews")
      .insert({
        org_id: org!.id,
        branch_id: branch!.id,
        provider_review_id: `dash-${runId}-${i}`,
        rating: 1,
        text: `Demora terrible ${i}`,
        review_date: date,
      })
      .select("id")
      .single();

    await admin.from("review_analysis").insert({
      review_id: review!.id,
      sentiment: "negative",
      categories: ["demora"],
      severity: 3,
      mentions_compensation: false,
      summary: "Demora",
      model: "test",
    });
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL("http://127.0.0.1:3000/");

  await page.goto("/dashboard?period=180");
  const branchCard = page.getByTestId(`branch-card-${branch!.id}`);
  await expect(branchCard.getByText("(2 reviews)")).toBeVisible();

  await page.getByRole("link", { name: "30 días" }).click();
  await expect(page).toHaveURL(/period=30/);
  await expect(branchCard.getByText("(1 reviews)")).toBeVisible();

  await expect(page.getByText("Heatmap sucursal")).toBeVisible();
  await expect(page.getByText("Distribución de sentimiento")).toBeVisible();
});
