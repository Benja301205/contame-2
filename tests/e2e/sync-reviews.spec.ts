process.loadEnvFile(`${process.cwd()}/.env.local`);

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";
import fixtures from "@/lib/providers/fixtures/reviews.json";

const ADMIN_EMAIL = `admin.${SEED_ORGS[0].slug}@contame.test`;

/**
 * Las syncs de reviews quedan reguladas por el equipo de Contame (consumen
 * una API paga), no por el admin del cliente: no hay botón en la UI, se
 * disparan por scripts/sync.ts o el cron de Vercel con CRON_SECRET. Este
 * test dispara el endpoint directamente (como haría el script) y verifica
 * el resultado en la UI de reviews que sí ve el admin.
 */
test("una sync disparada con CRON_SECRET guarda las reviews y el admin las ve en /reviews", async ({
  page,
}) => {
  const runId = `${Date.now()}`;
  const branchName = `Sucursal Sync E2E ${runId}`;
  const placeId = `place-sync-e2e-${runId}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL("http://127.0.0.1:3000/");

  await page.goto("/branches");
  await page.getByLabel("Nombre").fill(branchName);
  await page.getByLabel("Google Place ID").fill(placeId);
  await page.getByRole("button", { name: "Crear sucursal" }).click();
  await expect(page.getByText(branchName)).toBeVisible();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: branch } = await admin
    .from("branches")
    .select("id")
    .eq("google_place_id", placeId)
    .single();

  const syncResponse = await page.request.post("/api/sync-reviews", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    data: { branchId: branch!.id },
  });
  expect(syncResponse.ok()).toBe(true);
  const syncBody = await syncResponse.json();
  expect(syncBody.results).toEqual([
    { branchId: branch!.id, fetched: fixtures.length, new: fixtures.length },
  ]);

  await page.goto("/reviews");
  await page.getByLabel("Sucursal").selectOption({ label: branchName });
  await page.getByRole("button", { name: "Filtrar" }).click();

  await expect(page.getByText(fixtures[0].text!)).toBeVisible();
});

test("sin CRON_SECRET el endpoint de sync rechaza la request", async ({ page }) => {
  const res = await page.request.post("/api/sync-reviews", { data: {} });
  expect(res.status()).toBe(401);
});
