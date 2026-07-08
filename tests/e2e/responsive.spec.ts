import { expect, test } from "@playwright/test";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";

const MANAGER_EMAIL = `manager.${SEED_ORGS[0].slug}@contame.test`;

test.use({ viewport: { width: 375, height: 812 } });

test("check-in usable en viewport mobile (375px)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(MANAGER_EMAIL);
  await page.getByLabel("Contraseña").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL("http://127.0.0.1:3000/checkin");

  // Sin scroll horizontal: todo el contenido entra en el ancho del viewport.
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalScroll).toBe(false);

  // El nav y el contenido principal siguen siendo interactuables.
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
});
