import { expect, test } from "@playwright/test";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";

const ADMIN_EMAIL = `admin.${SEED_ORGS[0].slug}@contame.test`;
const MANAGER_EMAIL = `manager.${SEED_ORGS[0].slug}@contame.test`;

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /ingresar/i }).click();
}

test("ruta protegida sin sesión redirige a /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("login fallido muestra error y no navega", async ({ page }) => {
  await login(page, ADMIN_EMAIL, "password-incorrecta");
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("login exitoso lleva al home con nombre, rol y org", async ({ page }) => {
  await login(page, ADMIN_EMAIL, SEED_PASSWORD);
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await expect(page.getByText(`Organización: ${SEED_ORGS[0].name}`)).toBeVisible();
  await expect(page.getByText("Rol: Admin")).toBeVisible();
});

test("manager aterriza en /checkin después de loguearse (Loop 4: home = check-in)", async ({ page }) => {
  await login(page, MANAGER_EMAIL, SEED_PASSWORD);
  await expect(page).toHaveURL("http://127.0.0.1:3000/checkin");
});

test("manager que navega a /settings es redirigido (vía / -> /checkin)", async ({ page }) => {
  await login(page, MANAGER_EMAIL, SEED_PASSWORD);
  await expect(page).toHaveURL("http://127.0.0.1:3000/checkin");

  await page.goto("/settings");
  await expect(page).toHaveURL("http://127.0.0.1:3000/checkin");
});
