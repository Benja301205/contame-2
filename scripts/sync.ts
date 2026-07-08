const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!SITE_URL || !CRON_SECRET) {
  throw new Error("Faltan NEXT_PUBLIC_SITE_URL / CRON_SECRET (ver .env.local)");
}

function parseFlag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.slice(`--${name}=`.length);
}

async function callEndpoint(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${SITE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error(`Error ${res.status} en ${path}:`, json.error ?? json);
    process.exit(1);
  }
  return json;
}

async function sync() {
  const orgId = parseFlag("org");
  const branchId = parseFlag("branch");

  const syncBody = await callEndpoint("/api/sync-reviews", { orgId, branchId });

  for (const result of syncBody.results ?? []) {
    if ("error" in result) {
      console.error(`✗ sucursal ${result.branchId}: ${result.error}`);
    } else {
      console.log(`✔ sucursal ${result.branchId}: ${result.new} nuevas (${result.fetched} traídas)`);
    }
  }

  // "Se dispara automáticamente al final de cada sync" (Loop 3): el script
  // encadena el análisis de las reviews pending que acaban de entrar.
  console.log("Analizando reviews pendientes...");
  const analyzeBody = await callEndpoint("/api/analyze", { orgId, branchId });

  for (const result of analyzeBody.results ?? []) {
    if (result.status === "failed") {
      console.error(`✗ review ${result.reviewId}: ${result.error}`);
    } else {
      console.log(`✔ review ${result.reviewId}: analizada`);
    }
  }
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
