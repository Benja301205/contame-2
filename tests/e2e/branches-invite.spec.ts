import { expect, test } from "@playwright/test";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";

const MAILPIT_URL = "http://127.0.0.1:54324";
const ADMIN_EMAIL = `admin.${SEED_ORGS[0].slug}@contame.test`;

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL("http://127.0.0.1:3000/");
}

async function findInviteLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const body = await res.json();
    const message = body.messages.find((m: { To: { Address: string }[] }) =>
      m.To.some((to) => to.Address === email),
    );

    if (message) {
      const detail = await (await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json();
      const match = detail.Text.match(/(http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s)]+)/);
      if (match) return match[1];
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No llegó ningún mail de invitación a ${email}`);
}

test("admin crea sucursal, invita gerente y el gerente ve solo su sucursal", async ({
  page,
  context,
}) => {
  const runId = `${Date.now()}`;
  const branchName = `Sucursal E2E ${runId}`;
  const placeId = `place-e2e-${runId}`;
  const managerEmail = `gerente.e2e.${runId}@contame.test`;

  // 1. Admin crea una sucursal
  await login(page, ADMIN_EMAIL, SEED_PASSWORD);
  await page.goto("/branches");
  await page.getByLabel("Nombre").fill(branchName);
  await page.getByLabel("Google Place ID").fill(placeId);
  await page.getByRole("button", { name: "Crear sucursal" }).click();
  await expect(page.getByText(branchName)).toBeVisible();

  // 2. Admin invita a un gerente y le asigna esa sucursal
  await page.goto("/settings/users");
  await page.getByLabel("Email").fill(managerEmail);
  await page.getByLabel("Nombre").fill("Gerente E2E");
  await page.getByLabel(branchName).check();
  await page.getByRole("button", { name: /invitar gerente/i }).click();
  await expect(page.getByText(`Invitación enviada a ${managerEmail}.`)).toBeVisible();

  // 3. El gerente sigue el link del mail (capturado en Mailpit) y setea su contraseña
  const inviteLink = await findInviteLink(managerEmail);
  const managerPage = await context.newPage();
  await managerPage.goto(inviteLink);
  await managerPage.waitForURL(/\/set-password$/);
  await managerPage.getByLabel("Contraseña").fill("GerenteE2E123!");
  await managerPage.getByRole("button", { name: /guardar y entrar/i }).click();
  // La home del gerente es /checkin (Loop 4), no la pantalla de cuenta.
  await expect(managerPage).toHaveURL("http://127.0.0.1:3000/checkin");
  await expect(managerPage.getByText(branchName)).toBeVisible();

  // 4. El gerente ve solo la sucursal que le asignaron
  await managerPage.goto("/branches");
  await expect(managerPage.getByText(branchName)).toBeVisible();
  const branchCards = managerPage.locator("main >> text=" + branchName);
  await expect(branchCards).toHaveCount(1);
});
