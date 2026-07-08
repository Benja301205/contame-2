process.loadEnvFile(`${process.cwd()}/.env.local`);

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";

const MANAGER_EMAIL = `manager.${SEED_ORGS[0].slug}@contame.test`;

test("el manager completa el check-in con 2 tipos de compensación y ve el total", async ({ page }) => {
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

  const { data: manager } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", org!.id)
    .eq("full_name", `Gerente ${SEED_ORGS[0].name}`)
    .single();

  const runId = `${Date.now()}`;
  const { data: branch } = await admin
    .from("branches")
    .insert({
      org_id: org!.id,
      name: `Sucursal Checkin E2E ${runId}`,
      google_place_id: `place-checkin-e2e-${runId}`,
    })
    .select("id")
    .single();

  await admin.from("branch_managers").insert({ branch_id: branch!.id, profile_id: manager!.id });

  await page.goto("/login");
  await page.getByLabel("Email").fill(MANAGER_EMAIL);
  await page.getByLabel("Contraseña").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL("http://127.0.0.1:3000/checkin");

  const branchSection = page.locator("div.space-y-4", {
    has: page.getByRole("heading", { name: `Sucursal Checkin E2E ${runId}`, exact: true }),
  });
  const todayPanel = branchSection.getByTestId("checkin-panel-today");
  await expect(todayPanel.getByText("¿Hoy diste compensaciones?")).toBeVisible();
  await todayPanel.getByRole("button", { name: "Sí", exact: true }).click();

  const descuentoRow = page.locator("label", { hasText: "Descuento" }).first();
  await descuentoRow.locator("input[type=checkbox]").check();

  const postreRow = page.locator("label", { hasText: "Postre bonificado" }).first();
  await postreRow.locator("input[type=checkbox]").check();

  const quantityInputs = page.locator('input[id^="quantity-"]');
  await quantityInputs.nth(0).fill("2");
  await quantityInputs.nth(1).fill("1");

  // El costo unitario default de los tipos seed es 0 (Loop 1: se edita en
  // Settings). Cargamos un monto real para que el total no dé $0.
  const unitCostInputs = page.locator('input[id^="unitcost-"]');
  await unitCostInputs.nth(0).fill("500");
  await unitCostInputs.nth(1).fill("300");

  await page.getByRole("button", { name: "Guardar" }).click();

  const totalLocator = todayPanel.getByText(/^Total: \$/);
  await expect(totalLocator).toBeVisible();
  const totalText = await totalLocator.textContent();
  // formatMoney usa Intl.NumberFormat es-AR: "$ 1.300" (espacio no separable + punto de miles).
  const total = Number(totalText!.replace(/[^\d]/g, ""));
  expect(total).toBe(2 * 500 + 1 * 300);
});
